package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// spotifyClientID — ID público do app registrado em developer.spotify.com.
// Em PKCE não há client_secret, o ID pode viver no binário.
const spotifyClientID = "1975d56e19234254b84da9dec2a95d0e"

const (
	spotifyAuthURL      = "https://accounts.spotify.com/authorize"
	spotifyTokenURL     = "https://accounts.spotify.com/api/token"
	spotifyAPIBase      = "https://api.spotify.com/v1"
	spotifyRedirectURI  = "http://127.0.0.1:53682/callback"
	spotifyCallbackPort = 53682

	spotifyAccessKey    = "spotify.accessToken"
	spotifyRefreshKey   = "spotify.refreshToken"
	spotifyExpiresAtKey = "spotify.expiresAt"
)

var spotifyScopes = []string{
	"streaming",
	"user-read-playback-state",
	"user-modify-playback-state",
	"user-read-currently-playing",
	"playlist-read-private",
	"playlist-read-collaborative",
	"user-library-read",
	"user-library-modify",
	"user-read-private",
	"user-read-email",
}

type SpotifyAuthStatus struct {
	Connected bool  `json:"connected"`
	Expired   bool  `json:"expired"`
	ExpiresAt int64 `json:"expiresAt"`
}

type spotifyTokenResp struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

type Spotify struct {
	ctx    context.Context
	cfg    *Config
	client *http.Client

	mu sync.Mutex
}

func NewSpotify(cfg *Config) *Spotify {
	return &Spotify{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *Spotify) startup(ctx context.Context) {
	s.ctx = ctx
}

// ── Token helpers ─────────────────────────────────────────────────────────────

func (s *Spotify) getString(key string) string {
	if s.cfg == nil {
		return ""
	}
	v := s.cfg.Get(key, "")
	out, _ := v.(string)
	return out
}

func (s *Spotify) IsConnected() bool {
	return s.getString(spotifyRefreshKey) != ""
}

func (s *Spotify) Status() SpotifyAuthStatus {
	now := time.Now().Unix()
	exp := int64(0)
	if v := s.cfg.Get(spotifyExpiresAtKey, float64(0)); v != nil {
		switch x := v.(type) {
		case float64:
			exp = int64(x)
		case int64:
			exp = x
		case int:
			exp = int64(x)
		}
	}
	connected := s.IsConnected()
	return SpotifyAuthStatus{
		Connected: connected,
		Expired:   connected && (exp == 0 || now >= exp),
		ExpiresAt: exp,
	}
}

func (s *Spotify) Disconnect() error {
	if s.cfg == nil {
		return nil
	}
	_ = s.cfg.Reset(spotifyAccessKey)
	_ = s.cfg.Reset(spotifyRefreshKey)
	_ = s.cfg.Reset(spotifyExpiresAtKey)
	if s.ctx != nil {
		emit("spotify.changed")
	}
	return nil
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

func randomURLSafe(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func pkceChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// ── OAuth Authorization Code + PKCE ───────────────────────────────────────────

// Connect inicia o fluxo OAuth: sobe servidor loopback, abre o browser,
// aguarda o callback do Spotify (até 2min), troca code por tokens e persiste.
// Retorna um access_token válido.
func (s *Spotify) Connect() (string, error) {
	verifier, err := randomURLSafe(64)
	if err != nil {
		return "", fmt.Errorf("pkce verifier: %w", err)
	}
	state, err := randomURLSafe(16)
	if err != nil {
		return "", fmt.Errorf("state: %w", err)
	}
	challenge := pkceChallenge(verifier)

	// servidor loopback
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", spotifyCallbackPort))
	if err != nil {
		return "", fmt.Errorf("loopback :%d: %w", spotifyCallbackPort, err)
	}

	type cbResult struct {
		code string
		err  error
	}
	resCh := make(chan cbResult, 1)
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		gotState := q.Get("state")
		errParam := q.Get("error")
		code := q.Get("code")

		if errParam != "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprintf(w, "<html><body style='font-family:sans-serif;background:#18181b;color:#fafafa;padding:2rem'><h2>Erro ao autenticar</h2><p>%s</p><p>Pode fechar esta aba.</p></body></html>", errParam)
			resCh <- cbResult{err: fmt.Errorf("spotify auth: %s", errParam)}
			return
		}
		if gotState != state {
			http.Error(w, "state mismatch", http.StatusBadRequest)
			resCh <- cbResult{err: errors.New("state mismatch")}
			return
		}
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			resCh <- cbResult{err: errors.New("missing code")}
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, "<html><body style='font-family:sans-serif;background:#18181b;color:#fafafa;padding:2rem;text-align:center'><h2>Adila IDE conectado ao Spotify</h2><p>Pode fechar esta aba e voltar para o IDE.</p><script>setTimeout(()=>window.close(),800)</script></body></html>")
		resCh <- cbResult{code: code}
	})

	srv := &http.Server{Handler: mux}
	go func() { _ = srv.Serve(listener) }()
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	// monta authorize URL
	q := url.Values{}
	q.Set("client_id", spotifyClientID)
	q.Set("response_type", "code")
	q.Set("redirect_uri", spotifyRedirectURI)
	q.Set("code_challenge_method", "S256")
	q.Set("code_challenge", challenge)
	q.Set("state", state)
	q.Set("scope", strings.Join(spotifyScopes, " "))
	authorize := spotifyAuthURL + "?" + q.Encode()

	if s.ctx != nil {
		openBrowser(authorize)
	}

	select {
	case res := <-resCh:
		if res.err != nil {
			return "", res.err
		}
		return s.exchangeCode(res.code, verifier)
	case <-time.After(2 * time.Minute):
		return "", errors.New("tempo esgotado aguardando autenticação no Spotify")
	}
}

func (s *Spotify) exchangeCode(code, verifier string) (string, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", spotifyRedirectURI)
	form.Set("client_id", spotifyClientID)
	form.Set("code_verifier", verifier)

	tok, err := s.postToken(form)
	if err != nil {
		return "", err
	}
	if err := s.persistTokens(tok); err != nil {
		return "", err
	}
	if s.ctx != nil {
		emit("spotify.changed")
	}
	return tok.AccessToken, nil
}

func (s *Spotify) postToken(form url.Values) (*spotifyTokenResp, error) {
	req, err := http.NewRequestWithContext(s.ctx, "POST", spotifyTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var tok spotifyTokenResp
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("token: resposta inválida: %w", err)
	}
	if tok.Error != "" {
		return nil, fmt.Errorf("spotify token: %s — %s", tok.Error, tok.ErrorDesc)
	}
	if resp.StatusCode != 200 || tok.AccessToken == "" {
		return nil, fmt.Errorf("spotify token: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	return &tok, nil
}

func (s *Spotify) persistTokens(tok *spotifyTokenResp) error {
	if s.cfg == nil {
		return errors.New("config nil")
	}
	expiresAt := time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second).Unix()
	if err := s.cfg.Set(spotifyAccessKey, tok.AccessToken); err != nil {
		return err
	}
	// refresh_token só vem na primeira troca; refreshes subsequentes podem não trazer.
	if tok.RefreshToken != "" {
		if err := s.cfg.Set(spotifyRefreshKey, tok.RefreshToken); err != nil {
			return err
		}
	}
	if err := s.cfg.Set(spotifyExpiresAtKey, expiresAt); err != nil {
		return err
	}
	return nil
}

// GetAccessToken devolve um access_token válido. Se expirado, tenta refresh.
func (s *Spotify) GetAccessToken() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	access := s.getString(spotifyAccessKey)
	refresh := s.getString(spotifyRefreshKey)
	if refresh == "" {
		return "", errors.New("não autenticado")
	}

	expiresAt := int64(0)
	if v := s.cfg.Get(spotifyExpiresAtKey, float64(0)); v != nil {
		switch x := v.(type) {
		case float64:
			expiresAt = int64(x)
		case int64:
			expiresAt = x
		case int:
			expiresAt = int64(x)
		}
	}

	// margem de 60s para evitar token quase-expirado em chamadas longas
	if access != "" && time.Now().Unix() < expiresAt-60 {
		return access, nil
	}

	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", refresh)
	form.Set("client_id", spotifyClientID)
	tok, err := s.postToken(form)
	if err != nil {
		return "", err
	}
	if err := s.persistTokens(tok); err != nil {
		return "", err
	}
	return tok.AccessToken, nil
}
