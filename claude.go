package main

import (
	"bytes"
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
	claudeAPIKeyKey    = "claude.apiKey"
	claudeModelKey     = "claude.model"
	claudeDefaultModel = "claude-opus-4-7"
	claudeAPIBase      = "https://api.anthropic.com"
	claudeAPIVersion   = "2023-06-01"
)

// Claude expõe configuração e validação da API key da Anthropic. A key é
// guardada em settings.json (mesmo modelo dos tokens de Spotify/Linear). O
// frontend nunca recebe o valor real: getMasked devolve só os últimos 4
// caracteres pra confirmação visual.
type Claude struct {
	ctx    context.Context
	cfg    *Config
	client *http.Client
}

// ClaudeStatus é o payload consumido pelos componentes do welcome/settings.
type ClaudeStatus struct {
	Configured bool   `json:"configured"`
	Masked     string `json:"masked,omitempty"`
	Model      string `json:"model"`
}

func NewClaude(cfg *Config) *Claude {
	return &Claude{
		cfg:    cfg,
		client: &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *Claude) startup(ctx context.Context) {
	c.ctx = ctx
}

// GetStatus retorna o estado atual do conector pro frontend.
func (c *Claude) GetStatus() ClaudeStatus {
	key := c.getKey()
	model := c.getModel()
	return ClaudeStatus{
		Configured: key != "",
		Masked:     maskKey(key),
		Model:      model,
	}
}

// IsConfigured é um atalho usado pelo painel de welcome: o card só lista
// "conectado" quando a key está salva.
func (c *Claude) IsConfigured() bool {
	return c.getKey() != ""
}

// SaveApiKey valida o formato, opcionalmente faz uma chamada de teste contra
// a Anthropic, persiste e emite "claude.changed". Retorna o status pro
// frontend já com o masked atualizado.
func (c *Claude) SaveApiKey(key string, validate bool) (ClaudeStatus, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return ClaudeStatus{}, errors.New("API key vazia")
	}
	if !strings.HasPrefix(key, "sk-ant-") {
		return ClaudeStatus{}, errors.New("API key inválida (esperado prefixo sk-ant-)")
	}
	if validate {
		if err := c.ping(key); err != nil {
			return ClaudeStatus{}, fmt.Errorf("validação falhou: %w", err)
		}
	}
	if err := c.cfg.Set(claudeAPIKeyKey, key); err != nil {
		return ClaudeStatus{}, err
	}
	emit("claude.changed")
	return c.GetStatus(), nil
}

// ClearApiKey remove a key do disco e devolve status vazio.
func (c *Claude) ClearApiKey() error {
	if err := c.cfg.Reset(claudeAPIKeyKey); err != nil {
		return err
	}
	emit("claude.changed")
	return nil
}

// SetModel troca o modelo padrão usado pelo agente.
func (c *Claude) SetModel(model string) error {
	model = strings.TrimSpace(model)
	if model == "" {
		return errors.New("model vazio")
	}
	if err := c.cfg.Set(claudeModelKey, model); err != nil {
		return err
	}
	emit("claude.changed")
	return nil
}

func (c *Claude) getKey() string {
	v := c.cfg.Get(claudeAPIKeyKey, "")
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func (c *Claude) getModel() string {
	v := c.cfg.Get(claudeModelKey, claudeDefaultModel)
	s, _ := v.(string)
	if s == "" {
		return claudeDefaultModel
	}
	return s
}

// ping bate em /v1/messages com max_tokens=1 e ignora a resposta. Suficiente
// pra distinguir 200 (key válida) de 401 (inválida) e 4xx (formato errado).
func (c *Claude) ping(key string) error {
	body, _ := json.Marshal(map[string]any{
		"model":      c.getModel(),
		"max_tokens": 1,
		"messages": []map[string]string{
			{"role": "user", "content": "ping"},
		},
	})
	req, err := http.NewRequestWithContext(c.ctx, "POST", claudeAPIBase+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("x-api-key", key)
	req.Header.Set("anthropic-version", claudeAPIVersion)
	req.Header.Set("content-type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	raw, _ := io.ReadAll(resp.Body)
	// Tenta extrair só a mensagem de erro útil pra evitar vazar headers/body cru
	// no toast do frontend.
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

func maskKey(key string) string {
	if key == "" {
		return ""
	}
	if len(key) <= 12 {
		return "sk-ant-…"
	}
	return "sk-ant-…" + key[len(key)-4:]
}
