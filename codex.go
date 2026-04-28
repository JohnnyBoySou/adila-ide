package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	codexAPIKeyKey    = "codex.apiKey"
	codexModelKey     = "codex.model"
	codexDefaultModel = "gpt-5-codex"
	codexAPIBase      = "https://api.openai.com"
)

// Codex expõe a configuração da API key do OpenAI (usada pelo Codex / GPT).
// Mesmo padrão do Claude: key em settings.json, frontend só vê o status
// mascarado, validação opcional faz uma chamada de teste.
type Codex struct {
	ctx    context.Context
	cfg    *Config
	client *http.Client
}

type CodexStatus struct {
	Configured bool   `json:"configured"`
	Masked     string `json:"masked,omitempty"`
	Model      string `json:"model"`
}

func NewCodex(cfg *Config) *Codex {
	return &Codex{
		cfg:    cfg,
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Codex) startup(ctx context.Context) {
	c.ctx = ctx
}

func (c *Codex) GetStatus() CodexStatus {
	key := c.getKey()
	return CodexStatus{
		Configured: key != "",
		Masked:     maskCodexKey(key),
		Model:      c.getModel(),
	}
}

func (c *Codex) IsConfigured() bool {
	return c.getKey() != ""
}

// SaveApiKey aceita keys "sk-..." (legacy/user) e "sk-proj-..." (project).
// Valida formato, opcionalmente confirma com /v1/models, persiste e emite
// "codex.changed".
func (c *Codex) SaveApiKey(key string, validate bool) (CodexStatus, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return CodexStatus{}, errors.New("API key vazia")
	}
	if !strings.HasPrefix(key, "sk-") {
		return CodexStatus{}, errors.New("API key inválida (esperado prefixo sk-)")
	}
	if validate {
		if err := c.ping(key); err != nil {
			return CodexStatus{}, fmt.Errorf("validação falhou: %w", err)
		}
	}
	if err := c.cfg.Set(codexAPIKeyKey, key); err != nil {
		return CodexStatus{}, err
	}
	emit("codex.changed")
	return c.GetStatus(), nil
}

func (c *Codex) ClearApiKey() error {
	if err := c.cfg.Reset(codexAPIKeyKey); err != nil {
		return err
	}
	emit("codex.changed")
	return nil
}

func (c *Codex) SetModel(model string) error {
	model = strings.TrimSpace(model)
	if model == "" {
		return errors.New("model vazio")
	}
	if err := c.cfg.Set(codexModelKey, model); err != nil {
		return err
	}
	emit("codex.changed")
	return nil
}

func (c *Codex) getKey() string {
	v := c.cfg.Get(codexAPIKeyKey, "")
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func (c *Codex) getModel() string {
	v := c.cfg.Get(codexModelKey, codexDefaultModel)
	s, _ := v.(string)
	if s == "" {
		return codexDefaultModel
	}
	return s
}

// ping bate em /v1/models — endpoint barato (sem custo de tokens) que devolve
// 401 pra key inválida e 200 pra key válida.
func (c *Codex) ping(key string) error {
	req, err := http.NewRequestWithContext(c.ctx, "GET", codexAPIBase+"/v1/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	raw, _ := io.ReadAll(resp.Body)
	var parsed struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &parsed) == nil && parsed.Error.Message != "" {
		return fmt.Errorf("%s: %s", parsed.Error.Type, parsed.Error.Message)
	}
	return fmt.Errorf("HTTP %d", resp.StatusCode)
}

func maskCodexKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 8 {
		return "sk-…"
	}
	return "sk-…" + key[len(key)-4:]
}
