package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// githubClientID identifica o OAuth App registrado em github.com/settings/developers.
// Para apps desktop o Client ID não é segredo (Device Flow não usa client_secret).
// Substitua pelo Client ID do seu OAuth App antes de distribuir.
const githubClientID = "Ov23liin2A54us9DvIoX"

const (
	githubDeviceCodeURL  = "https://github.com/login/device/code"
	githubAccessTokenURL = "https://github.com/login/oauth/access_token"
	githubAPIBase        = "https://api.github.com"
	githubTokenKey       = "github.token"
)

type GitHubUser struct {
	Login       string `json:"login"`
	Name        string `json:"name"`
	AvatarURL   string `json:"avatarUrl"`
	Bio         string `json:"bio"`
	Company     string `json:"company"`
	Location    string `json:"location"`
	Blog        string `json:"blog"`
	Email       string `json:"email"`
	HTMLURL     string `json:"htmlUrl"`
	PublicRepos int    `json:"publicRepos"`
	Followers   int    `json:"followers"`
	Following   int    `json:"following"`
	CreatedAt   string `json:"createdAt"`
}

type DeviceFlowStart struct {
	UserCode        string `json:"userCode"`
	VerificationURI string `json:"verificationUri"`
	DeviceCode      string `json:"deviceCode"`
	Interval        int    `json:"interval"`
	ExpiresIn       int    `json:"expiresIn"`
}

type GitHubRepo struct {
	Name     string `json:"name"`
	CloneURL string `json:"cloneUrl"`
	SSHURL   string `json:"sshUrl"`
	HTMLURL  string `json:"htmlUrl"`
}

type GitHubNotification struct {
	ID         string `json:"id"`
	Reason     string `json:"reason"`
	Unread     bool   `json:"unread"`
	UpdatedAt  string `json:"updatedAt"`
	Title      string `json:"title"`
	Type       string `json:"type"`
	URL        string `json:"url"`
	HTMLURL    string `json:"htmlUrl"`
	RepoName   string `json:"repoName"`
	RepoFull   string `json:"repoFull"`
	RepoAvatar string `json:"repoAvatar"`
}

type GitHub struct {
	ctx    context.Context
	cfg    *Config
	git    *Git
	client *http.Client

	mu       sync.Mutex
	pollStop chan struct{}
}

func NewGitHub(cfg *Config, git *Git) *GitHub {
	return &GitHub{
		cfg:    cfg,
		git:    git,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (g *GitHub) startup(ctx context.Context) {
	g.ctx = ctx
}

// ── Token helpers ─────────────────────────────────────────────────────────────

func (g *GitHub) token() string {
	if g.cfg == nil {
		return ""
	}
	v := g.cfg.Get(githubTokenKey, "")
	s, _ := v.(string)
	return s
}

func (g *GitHub) IsAuthenticated() bool {
	return g.token() != ""
}

func (g *GitHub) Logout() error {
	if g.cfg == nil {
		return nil
	}
	g.cancelPolling()
	return g.cfg.Reset(githubTokenKey)
}

func (g *GitHub) cancelPolling() {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.pollStop != nil {
		close(g.pollStop)
		g.pollStop = nil
	}
}

// ── Device Flow ───────────────────────────────────────────────────────────────

// StartDeviceFlow inicia o fluxo, retorna user_code e verification_uri para exibir ao usuário.
func (g *GitHub) StartDeviceFlow() (DeviceFlowStart, error) {
	form := url.Values{}
	form.Set("client_id", githubClientID)
	form.Set("scope", "repo notifications")

	req, err := http.NewRequestWithContext(g.ctx, "POST", githubDeviceCodeURL, strings.NewReader(form.Encode()))
	if err != nil {
		return DeviceFlowStart{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return DeviceFlowStart{}, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return DeviceFlowStart{}, fmt.Errorf("github device code: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var raw struct {
		DeviceCode      string `json:"device_code"`
		UserCode        string `json:"user_code"`
		VerificationURI string `json:"verification_uri"`
		ExpiresIn       int    `json:"expires_in"`
		Interval        int    `json:"interval"`
		Error           string `json:"error"`
		ErrorDesc       string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return DeviceFlowStart{}, fmt.Errorf("github device code: resposta inválida: %w", err)
	}
	if raw.Error != "" {
		return DeviceFlowStart{}, fmt.Errorf("github device code: %s — %s", raw.Error, raw.ErrorDesc)
	}
	if raw.Interval <= 0 {
		raw.Interval = 5
	}

	return DeviceFlowStart{
		DeviceCode:      raw.DeviceCode,
		UserCode:        raw.UserCode,
		VerificationURI: raw.VerificationURI,
		Interval:        raw.Interval,
		ExpiresIn:       raw.ExpiresIn,
	}, nil
}

// PollDeviceToken faz polling até GitHub aprovar (ou expirar). Quando aprovado,
// armazena o token via Config e emite "github.changed".
func (g *GitHub) PollDeviceToken(deviceCode string, interval int) error {
	if deviceCode == "" {
		return errors.New("device_code vazio")
	}
	if interval <= 0 {
		interval = 5
	}

	g.mu.Lock()
	if g.pollStop != nil {
		close(g.pollStop)
	}
	stop := make(chan struct{})
	g.pollStop = stop
	g.mu.Unlock()

	wait := time.Duration(interval) * time.Second
	deadline := time.Now().Add(15 * time.Minute)

	for {
		if time.Now().After(deadline) {
			return errors.New("device flow: tempo esgotado")
		}
		select {
		case <-g.ctx.Done():
			return g.ctx.Err()
		case <-stop:
			return errors.New("device flow: cancelado")
		case <-time.After(wait):
		}

		token, slowDown, pending, err := g.exchangeDeviceCode(deviceCode)
		if err != nil {
			return err
		}
		if slowDown {
			wait += 5 * time.Second
			continue
		}
		if pending {
			continue
		}
		if token != "" {
			if err := g.cfg.Set(githubTokenKey, token); err != nil {
				return err
			}
			if g.ctx != nil {
				wruntime.EventsEmit(g.ctx, "github.changed")
			}
			g.mu.Lock()
			if g.pollStop == stop {
				g.pollStop = nil
			}
			g.mu.Unlock()
			return nil
		}
	}
}

// CancelDeviceFlow interrompe o polling em curso (se houver).
func (g *GitHub) CancelDeviceFlow() {
	g.cancelPolling()
}

func (g *GitHub) exchangeDeviceCode(deviceCode string) (token string, slowDown bool, pending bool, err error) {
	form := url.Values{}
	form.Set("client_id", githubClientID)
	form.Set("device_code", deviceCode)
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:device_code")

	req, e := http.NewRequestWithContext(g.ctx, "POST", githubAccessTokenURL, strings.NewReader(form.Encode()))
	if e != nil {
		return "", false, false, e
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, e := g.client.Do(req)
	if e != nil {
		return "", false, false, e
	}
	defer resp.Body.Close()

	var raw struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if e := json.NewDecoder(resp.Body).Decode(&raw); e != nil {
		return "", false, false, fmt.Errorf("github token: resposta inválida: %w", e)
	}

	switch raw.Error {
	case "":
		return raw.AccessToken, false, false, nil
	case "authorization_pending":
		return "", false, true, nil
	case "slow_down":
		return "", true, false, nil
	case "expired_token", "access_denied", "incorrect_device_code", "unsupported_grant_type":
		return "", false, false, fmt.Errorf("github device flow: %s — %s", raw.Error, raw.ErrorDesc)
	default:
		return "", false, false, fmt.Errorf("github device flow: %s — %s", raw.Error, raw.ErrorDesc)
	}
}

// ── API REST ──────────────────────────────────────────────────────────────────

func (g *GitHub) apiRequest(method, path string, body any) (*http.Response, error) {
	// Bench mede latência de TODAS as chamadas REST GitHub. Nome inclui método+
	// path pra separar (ex: "GitHub.api.GET /user" vs "POST /user/repos").
	defer bench.Time("GitHub.api." + method + " " + path)()
	tok := g.token()
	if tok == "" {
		return nil, errors.New("não autenticado no GitHub")
	}

	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		rdr = strings.NewReader(string(b))
	}

	req, err := http.NewRequestWithContext(g.ctx, method, githubAPIBase+path, rdr)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return g.client.Do(req)
}

func (g *GitHub) GetUser() (GitHubUser, error) {
	resp, err := g.apiRequest("GET", "/user", nil)
	if err != nil {
		return GitHubUser{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return GitHubUser{}, fmt.Errorf("github /user: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var raw struct {
		Login       string `json:"login"`
		Name        string `json:"name"`
		AvatarURL   string `json:"avatar_url"`
		Bio         string `json:"bio"`
		Company     string `json:"company"`
		Location    string `json:"location"`
		Blog        string `json:"blog"`
		Email       string `json:"email"`
		HTMLURL     string `json:"html_url"`
		PublicRepos int    `json:"public_repos"`
		Followers   int    `json:"followers"`
		Following   int    `json:"following"`
		CreatedAt   string `json:"created_at"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return GitHubUser{}, err
	}
	return GitHubUser{
		Login:       raw.Login,
		Name:        raw.Name,
		AvatarURL:   raw.AvatarURL,
		Bio:         raw.Bio,
		Company:     raw.Company,
		Location:    raw.Location,
		Blog:        raw.Blog,
		Email:       raw.Email,
		HTMLURL:     raw.HTMLURL,
		PublicRepos: raw.PublicRepos,
		Followers:   raw.Followers,
		Following:   raw.Following,
		CreatedAt:   raw.CreatedAt,
	}, nil
}

type GitHubUserRepo struct {
	Name        string `json:"name"`
	FullName    string `json:"fullName"`
	Description string `json:"description"`
	HTMLURL     string `json:"htmlUrl"`
	CloneURL    string `json:"cloneUrl"`
	Language    string `json:"language"`
	Stars       int    `json:"stars"`
	Forks       int    `json:"forks"`
	Watchers    int    `json:"watchers"`
	UpdatedAt   string `json:"updatedAt"`
	Private     bool   `json:"private"`
	Fork        bool   `json:"fork"`
	Archived    bool   `json:"archived"`
}

type GitHubEvent struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	RepoName  string `json:"repoName"`
	RepoURL   string `json:"repoUrl"`
	CreatedAt string `json:"createdAt"`
	Action    string `json:"action"`
	Ref       string `json:"ref"`
	Title     string `json:"title"`
	Number    int    `json:"number"`
	URL       string `json:"url"`
}

// ListMyRepos retorna até `limit` repos do usuário ordenados por update recente.
func (g *GitHub) ListMyRepos(limit int) ([]GitHubUserRepo, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	resp, err := g.apiRequest(
		"GET",
		fmt.Sprintf("/user/repos?sort=updated&per_page=%d&affiliation=owner", limit),
		nil,
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github /user/repos: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var raw []struct {
		Name        string `json:"name"`
		FullName    string `json:"full_name"`
		Description string `json:"description"`
		HTMLURL     string `json:"html_url"`
		CloneURL    string `json:"clone_url"`
		Language    string `json:"language"`
		Stars       int    `json:"stargazers_count"`
		Forks       int    `json:"forks_count"`
		Watchers    int    `json:"watchers_count"`
		UpdatedAt   string `json:"updated_at"`
		Private     bool   `json:"private"`
		Fork        bool   `json:"fork"`
		Archived    bool   `json:"archived"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	out := make([]GitHubUserRepo, 0, len(raw))
	for _, r := range raw {
		out = append(out, GitHubUserRepo{
			Name:        r.Name,
			FullName:    r.FullName,
			Description: r.Description,
			HTMLURL:     r.HTMLURL,
			CloneURL:    r.CloneURL,
			Language:    r.Language,
			Stars:       r.Stars,
			Forks:       r.Forks,
			Watchers:    r.Watchers,
			UpdatedAt:   r.UpdatedAt,
			Private:     r.Private,
			Fork:        r.Fork,
			Archived:    r.Archived,
		})
	}
	return out, nil
}

// ListMyEvents retorna eventos recentes (push, PR, issue, star) do usuário.
func (g *GitHub) ListMyEvents(login string, limit int) ([]GitHubEvent, error) {
	if strings.TrimSpace(login) == "" {
		return nil, errors.New("login vazio")
	}
	if limit <= 0 || limit > 100 {
		limit = 30
	}
	resp, err := g.apiRequest(
		"GET",
		fmt.Sprintf("/users/%s/events/public?per_page=%d", url.PathEscape(login), limit),
		nil,
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github events: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var raw []struct {
		ID        string `json:"id"`
		Type      string `json:"type"`
		CreatedAt string `json:"created_at"`
		Repo      struct {
			Name string `json:"name"`
			URL  string `json:"url"`
		} `json:"repo"`
		Payload map[string]any `json:"payload"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}
	out := make([]GitHubEvent, 0, len(raw))
	for _, ev := range raw {
		e := GitHubEvent{
			ID:        ev.ID,
			Type:      ev.Type,
			CreatedAt: ev.CreatedAt,
			RepoName:  ev.Repo.Name,
			RepoURL:   "https://github.com/" + ev.Repo.Name,
		}
		if action, ok := ev.Payload["action"].(string); ok {
			e.Action = action
		}
		if refStr, ok := ev.Payload["ref"].(string); ok {
			e.Ref = strings.TrimPrefix(refStr, "refs/heads/")
		}
		// PullRequestEvent / IssuesEvent
		if pr, ok := ev.Payload["pull_request"].(map[string]any); ok {
			if t, ok := pr["title"].(string); ok {
				e.Title = t
			}
			if n, ok := pr["number"].(float64); ok {
				e.Number = int(n)
			}
			if u, ok := pr["html_url"].(string); ok {
				e.URL = u
			}
		}
		if iss, ok := ev.Payload["issue"].(map[string]any); ok {
			if t, ok := iss["title"].(string); ok {
				e.Title = t
			}
			if n, ok := iss["number"].(float64); ok {
				e.Number = int(n)
			}
			if u, ok := iss["html_url"].(string); ok {
				e.URL = u
			}
		}
		out = append(out, e)
	}
	return out, nil
}

// GetNotifications retorna as notificações do GitHub do usuário autenticado.
// Se all=false, traz só não lidas. Converte issue/PR URLs para HTML (clicáveis).
func (g *GitHub) GetNotifications(all bool) ([]GitHubNotification, error) {
	path := "/notifications"
	if all {
		path += "?all=true"
	}
	resp, err := g.apiRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("github /notifications: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var raw []struct {
		ID      string `json:"id"`
		Reason  string `json:"reason"`
		Unread  bool   `json:"unread"`
		Updated string `json:"updated_at"`
		Subject struct {
			Title string `json:"title"`
			URL   string `json:"url"`
			Type  string `json:"type"`
		} `json:"subject"`
		Repository struct {
			Name     string `json:"name"`
			FullName string `json:"full_name"`
			HTMLURL  string `json:"html_url"`
			Owner    struct {
				AvatarURL string `json:"avatar_url"`
			} `json:"owner"`
		} `json:"repository"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("github notifications: resposta inválida: %w", err)
	}
	out := make([]GitHubNotification, 0, len(raw))
	for _, n := range raw {
		htmlURL := apiToHTMLURL(n.Subject.URL, n.Repository.HTMLURL)
		out = append(out, GitHubNotification{
			ID:         n.ID,
			Reason:     n.Reason,
			Unread:     n.Unread,
			UpdatedAt:  n.Updated,
			Title:      n.Subject.Title,
			Type:       n.Subject.Type,
			URL:        n.Subject.URL,
			HTMLURL:    htmlURL,
			RepoName:   n.Repository.Name,
			RepoFull:   n.Repository.FullName,
			RepoAvatar: n.Repository.Owner.AvatarURL,
		})
	}
	return out, nil
}

// MarkNotificationRead marca uma notificação como lida (PATCH /notifications/threads/:id).
func (g *GitHub) MarkNotificationRead(id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("id vazio")
	}
	resp, err := g.apiRequest("PATCH", "/notifications/threads/"+url.PathEscape(id), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("github mark read: %s — %s", resp.Status, strings.TrimSpace(string(body)))
}

// MarkAllNotificationsRead marca todas as notificações como lidas (PUT /notifications).
func (g *GitHub) MarkAllNotificationsRead() error {
	resp, err := g.apiRequest("PUT", "/notifications", map[string]any{
		"read": true,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("github mark all read: %s — %s", resp.Status, strings.TrimSpace(string(body)))
}

// apiToHTMLURL converte uma URL da API REST (api.github.com/repos/.../issues/123)
// na URL HTML correspondente (github.com/.../issues/123). Fallback: repo HTMLURL.
func apiToHTMLURL(apiURL, repoHTML string) string {
	if apiURL == "" {
		return repoHTML
	}
	// /repos/owner/repo/(issues|pulls|releases)/N → owner/repo/(issues|pull|releases)/N
	const prefix = "https://api.github.com/repos/"
	if !strings.HasPrefix(apiURL, prefix) {
		return repoHTML
	}
	rest := strings.TrimPrefix(apiURL, prefix)
	rest = strings.Replace(rest, "/pulls/", "/pull/", 1)
	return "https://github.com/" + rest
}

// CreateAndPublish cria um repo no perfil do usuário, adiciona "origin" no
// workdir atual (com token embutido na URL para HTTPS push) e faz push.
func (g *GitHub) CreateAndPublish(name string, private bool) (GitHubRepo, error) {
	if name = strings.TrimSpace(name); name == "" {
		return GitHubRepo{}, errors.New("nome do repositório vazio")
	}
	if g.git == nil || g.git.workdir == "" {
		return GitHubRepo{}, errors.New("nenhuma pasta aberta")
	}
	if !g.git.IsRepo() {
		if err := g.git.Init(); err != nil {
			return GitHubRepo{}, fmt.Errorf("git init: %w", err)
		}
	}

	resp, err := g.apiRequest("POST", "/user/repos", map[string]any{
		"name":      name,
		"private":   private,
		"auto_init": false,
	})
	if err != nil {
		return GitHubRepo{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 201 {
		return GitHubRepo{}, fmt.Errorf("github create repo: %s — %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var raw struct {
		Name     string `json:"name"`
		CloneURL string `json:"clone_url"`
		SSHURL   string `json:"ssh_url"`
		HTMLURL  string `json:"html_url"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return GitHubRepo{}, err
	}

	authedURL := injectTokenIntoURL(raw.CloneURL, g.token())
	if err := g.git.AddRemote("origin", authedURL); err != nil {
		return GitHubRepo{}, fmt.Errorf("git remote add: %w", err)
	}

	if has, _ := g.git.HasCommits(); !has {
		if err := g.git.firstCommitIfEmpty(); err != nil {
			return GitHubRepo{}, fmt.Errorf("commit inicial: %w", err)
		}
	}

	if err := g.git.Push(); err != nil {
		return GitHubRepo{}, fmt.Errorf("git push: %w", err)
	}

	return GitHubRepo{
		Name:     raw.Name,
		CloneURL: raw.CloneURL,
		SSHURL:   raw.SSHURL,
		HTMLURL:  raw.HTMLURL,
	}, nil
}

// CloneRepo clona um repositório GitHub para parentDir/name.
// Injeta o token de autenticação na URL HTTPS pra repos privados funcionarem.
// Retorna o caminho absoluto do diretório clonado.
func (g *GitHub) CloneRepo(cloneURL, parentDir, name string) (string, error) {
	cloneURL = strings.TrimSpace(cloneURL)
	parentDir = strings.TrimSpace(parentDir)
	name = strings.TrimSpace(name)
	if cloneURL == "" {
		return "", errors.New("URL de clone vazia")
	}
	if parentDir == "" {
		return "", errors.New("pasta de destino não informada")
	}
	if name == "" {
		return "", errors.New("nome do repositório vazio")
	}
	// sanity: name não pode ter separadores de path
	if strings.ContainsAny(name, `/\`) || name == "." || name == ".." {
		return "", fmt.Errorf("nome inválido: %q", name)
	}

	absParent, err := filepath.Abs(parentDir)
	if err != nil {
		return "", fmt.Errorf("caminho inválido: %w", err)
	}
	info, err := os.Stat(absParent)
	if err != nil {
		return "", fmt.Errorf("pasta de destino não acessível: %w", err)
	}
	if !info.IsDir() {
		return "", fmt.Errorf("destino não é uma pasta: %s", absParent)
	}

	dest := filepath.Join(absParent, name)
	if _, err := os.Stat(dest); err == nil {
		return "", fmt.Errorf("já existe %s", dest)
	}

	authedURL := injectTokenIntoURL(cloneURL, g.token())

	ctx := g.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cmd := exec.CommandContext(ctx, "git", "clone", "--", authedURL, dest)
	var errBuf bytes.Buffer
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(errBuf.String())
		// Sanear: o token pode aparecer em mensagens de erro do git
		if tok := g.token(); tok != "" {
			msg = strings.ReplaceAll(msg, tok, "***")
		}
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("git clone falhou: %s", msg)
	}
	return dest, nil
}

// injectTokenIntoURL transforma "https://github.com/foo/bar.git" em
// "https://x-access-token:TOKEN@github.com/foo/bar.git" para que git push
// funcione sem prompt. Mantém o esquema original se já tiver credenciais.
func injectTokenIntoURL(cloneURL, token string) string {
	if token == "" {
		return cloneURL
	}
	u, err := url.Parse(cloneURL)
	if err != nil || u.Scheme != "https" {
		return cloneURL
	}
	if u.User != nil {
		return cloneURL
	}
	u.User = url.UserPassword("x-access-token", token)
	return u.String()
}
