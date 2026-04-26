package main

import (
	"bytes"
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

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// linearDefaultClientID é o Client ID do OAuth app registrado em linear.app/settings/api.
// Redirect URI configurado: http://localhost:19281/callback
const linearDefaultClientID = "11f9dc9438c56451d4dad0b840217572"

// linearCallbackPort é a porta local usada para receber o callback OAuth.
const linearCallbackPort = 19281

const (
	linearAuthURL    = "https://linear.app/oauth/authorize"
	linearTokenURL   = "https://api.linear.app/oauth/token"
	linearGraphQLURL = "https://api.linear.app/graphql"
	linearTokenKey   = "linear.token"
	linearClientKey  = "linear.clientId"
)

// ── Tipos ─────────────────────────────────────────────────────────────────────

type LinearUser struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	AvatarURL   string `json:"avatarUrl"`
	DisplayName string `json:"displayName"`
}

type LinearState struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
	Type  string `json:"type"` // backlog | unstarted | started | completed | cancelled
}

type LinearTeam struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Key  string `json:"key"`
}

type LinearProject struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type LinearIssue struct {
	ID         string         `json:"id"`
	Identifier string         `json:"identifier"`
	Title      string         `json:"title"`
	Priority   int            `json:"priority"` // 0=none 1=urgent 2=high 3=medium 4=low
	URL        string         `json:"url"`
	CreatedAt  string         `json:"createdAt"`
	UpdatedAt  string         `json:"updatedAt"`
	DueDate    string         `json:"dueDate"`
	State      LinearState    `json:"state"`
	Team       LinearTeam     `json:"team"`
	Project    *LinearProject `json:"project"`
}

// ── Struct ────────────────────────────────────────────────────────────────────

type Linear struct {
	ctx    context.Context
	cfg    *Config
	client *http.Client
	mu     sync.Mutex
}

func NewLinear(cfg *Config) *Linear {
	return &Linear{
		cfg:    cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (l *Linear) startup(ctx context.Context) { l.ctx = ctx }

// ── Token helpers ─────────────────────────────────────────────────────────────

func (l *Linear) token() string {
	v := l.cfg.Get(linearTokenKey, "")
	s, _ := v.(string)
	return s
}

func (l *Linear) clientID() string {
	v := l.cfg.Get(linearClientKey, "")
	s, _ := v.(string)
	if s == "" {
		return linearDefaultClientID
	}
	return s
}

func (l *Linear) IsAuthenticated() bool { return l.token() != "" }

func (l *Linear) Logout() error {
	return l.cfg.Reset(linearTokenKey)
}

// SetClientID persiste o client_id na config.
func (l *Linear) SetClientID(id string) error {
	return l.cfg.Set(linearClientKey, strings.TrimSpace(id))
}

func (l *Linear) GetClientID() string { return l.clientID() }

// ── PKCE helpers ──────────────────────────────────────────────────────────────

func generatePKCE() (verifier, challenge string, err error) {
	b := make([]byte, 64)
	if _, err = rand.Read(b); err != nil {
		return
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)
	h := sha256.Sum256([]byte(verifier))
	challenge = base64.RawURLEncoding.EncodeToString(h[:])
	return
}

func generateState() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

// StartOAuth inicia o fluxo OAuth 2.0 com PKCE para o Linear.
// Abre o browser, aguarda o callback local e salva o token na config.
func (l *Linear) StartOAuth() error {
	clientID := l.clientID()
	if clientID == "" {
		return errors.New("client_id não configurado — entre com o Client ID do seu Linear OAuth App")
	}

	verifier, challenge, err := generatePKCE()
	if err != nil {
		return fmt.Errorf("pkce: %w", err)
	}
	stateStr := generateState()
	redirectURI := fmt.Sprintf("http://localhost:%d/callback", linearCallbackPort)

	authURL, _ := url.Parse(linearAuthURL)
	q := authURL.Query()
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("scope", "read")
	q.Set("state", stateStr)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	authURL.RawQuery = q.Encode()

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	srv := &http.Server{Addr: fmt.Sprintf(":%d", linearCallbackPort), Handler: mux}

	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Query()
		if p.Get("state") != stateStr {
			http.Error(w, "state mismatch", http.StatusBadRequest)
			errCh <- errors.New("state mismatch no callback")
			return
		}
		if e := p.Get("error"); e != "" {
			desc := p.Get("error_description")
			http.Error(w, desc, http.StatusForbidden)
			errCh <- fmt.Errorf("linear oauth: %s — %s", e, desc)
			return
		}
		code := p.Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			errCh <- errors.New("code ausente no callback")
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, callbackHTML("Linear conectado! Pode fechar esta aba e voltar para o Adila IDE."))
		codeCh <- code
	})

	ln, err := net.Listen("tcp", srv.Addr)
	if err != nil {
		return fmt.Errorf("porta %d ocupada: %w", linearCallbackPort, err)
	}
	go func() { _ = srv.Serve(ln) }()

	wruntime.BrowserOpenURL(l.ctx, authURL.String())

	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()

	select {
	case code := <-codeCh:
		tok, err := l.exchangeCode(code, verifier, redirectURI, clientID)
		if err != nil {
			return fmt.Errorf("troca de código: %w", err)
		}
		if err := l.cfg.Set(linearTokenKey, tok); err != nil {
			return fmt.Errorf("salvar token: %w", err)
		}
		wruntime.EventsEmit(l.ctx, "linear.authed")
		return nil
	case err := <-errCh:
		return err
	case <-time.After(5 * time.Minute):
		return errors.New("timeout aguardando autorização (5 min)")
	}
}

func (l *Linear) exchangeCode(code, verifier, redirectURI, clientID string) (string, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", clientID)
	form.Set("code_verifier", verifier)
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(l.ctx, "POST", linearTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := l.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("resposta inválida: %w", err)
	}
	if result.Error != "" {
		return "", fmt.Errorf("%s: %s", result.Error, result.ErrorDesc)
	}
	if result.AccessToken == "" {
		return "", errors.New("token vazio na resposta")
	}
	return result.AccessToken, nil
}

// ── GraphQL ───────────────────────────────────────────────────────────────────

func (l *Linear) graphql(query string, variables map[string]interface{}, out interface{}) error {
	payload := map[string]interface{}{"query": query}
	if variables != nil {
		payload["variables"] = variables
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(l.ctx, "POST", linearGraphQLURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+l.token())

	resp, err := l.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == 401 {
		return errors.New("token inválido ou expirado — reconecte com o Linear")
	}

	var envelope struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(respBody, &envelope); err != nil {
		return fmt.Errorf("resposta inválida: %w", err)
	}
	if len(envelope.Errors) > 0 {
		return fmt.Errorf("graphql: %s", envelope.Errors[0].Message)
	}
	if out != nil {
		return json.Unmarshal(envelope.Data, out)
	}
	return nil
}

// GetMe retorna o perfil do usuário autenticado.
func (l *Linear) GetMe() (LinearUser, error) {
	q := `query { viewer { id name email avatarUrl displayName } }`
	var data struct {
		Viewer LinearUser `json:"viewer"`
	}
	if err := l.graphql(q, nil, &data); err != nil {
		return LinearUser{}, err
	}
	return data.Viewer, nil
}

// GetMyIssues lista issues atribuídas ao usuário autenticado, excluindo
// as já concluídas ou canceladas.
func (l *Linear) GetMyIssues() ([]LinearIssue, error) {
	q := `query MyIssues {
		viewer {
			assignedIssues(
				first: 100
				filter: { state: { type: { nin: ["cancelled", "completed"] } } }
				orderBy: updatedAt
			) {
				nodes {
					id
					identifier
					title
					priority
					url
					createdAt
					updatedAt
					dueDate
					state { id name color type }
					team { id name key }
					project { id name color }
				}
			}
		}
	}`
	var data struct {
		Viewer struct {
			AssignedIssues struct {
				Nodes []LinearIssue `json:"nodes"`
			} `json:"assignedIssues"`
		} `json:"viewer"`
	}
	if err := l.graphql(q, nil, &data); err != nil {
		return nil, err
	}
	return data.Viewer.AssignedIssues.Nodes, nil
}

// ── HTML helper ───────────────────────────────────────────────────────────────

func callbackHTML(msg string) string {
	return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>*{margin:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;
background:#0f0f0f;color:#e5e5e5;display:flex;align-items:center;
justify-content:center;height:100vh}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;
padding:40px 48px;text-align:center;max-width:420px}
h2{font-size:1.2rem;margin-bottom:8px;color:#fff}
p{color:#888;font-size:.9rem}</style></head>
<body><div class="card"><h2>✓ ` + msg + `</h2>
<p>Esta aba pode ser fechada.</p></div></body></html>`
}
