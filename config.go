package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Config persiste configurações do usuário em ~/.config/adila/settings.json.
// Thread-safe; salva com debounce de 400 ms para não escrever em disco
// a cada keystroke quando o usuário arrasta um slider ou digita num input.
type Config struct {
	ctx    context.Context
	mu     sync.RWMutex
	data   map[string]any
	path   string
	saveCh chan struct{}
}

func NewConfig() *Config {
	return &Config{
		data:   make(map[string]any),
		saveCh: make(chan struct{}, 1),
	}
}

func (c *Config) startup(ctx context.Context) {
	c.ctx = ctx
	if path, err := settingsFilePath(); err == nil {
		c.path = path
		c.load()
	}
	go c.saveLoop()
}

func (c *Config) shutdown(_ context.Context) {
	// Flush síncrono garante que nada se perde mesmo se saveLoop ainda
	// não tiver disparado o debounce ao fechar o app.
	c.flush()
}

// ── Persistência ──────────────────────────────────────────────────────────────

func (c *Config) load() {
	raw, err := os.ReadFile(c.path)
	if err != nil {
		return // arquivo não existe ainda — normal na primeira execução
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = json.Unmarshal(raw, &c.data)
}

func (c *Config) flush() {
	c.mu.RLock()
	snap := make(map[string]any, len(c.data))
	for k, v := range c.data {
		snap[k] = v
	}
	c.mu.RUnlock()

	if c.path == "" {
		return
	}
	b, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(c.path, b, 0o644)
}

// saveLoop debounce: só grava se nenhum Set novo chegar em 400 ms.
func (c *Config) saveLoop() {
	const debounce = 400 * time.Millisecond
	timer := time.NewTimer(debounce)
	timer.Stop()

	for {
		select {
		case <-c.saveCh:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(debounce)
		case <-timer.C:
			c.flush()
		case <-c.ctx.Done():
			c.flush()
			return
		}
	}
}

func (c *Config) scheduleSave() {
	select {
	case c.saveCh <- struct{}{}:
	default: // já há um save agendado
	}
}

// ── API pública (exposta ao Wails) ────────────────────────────────────────────

// Get retorna o valor armazenado para key, ou defaultValue se a chave não existir.
func (c *Config) Get(key string, defaultValue any) any {
	c.mu.RLock()
	v, ok := c.data[key]
	c.mu.RUnlock()
	if !ok {
		return defaultValue
	}
	return v
}

// Set armazena value para key e emite o evento "config.changed" no frontend.
func (c *Config) Set(key string, value any) error {
	c.mu.Lock()
	c.data[key] = value
	c.mu.Unlock()
	c.scheduleSave()
	if c.ctx != nil {
		wruntime.EventsEmit(c.ctx, "config.changed", map[string]any{
			"key":   key,
			"value": value,
		})
	}
	return nil
}

// Reset remove key (próximo Get retorna o defaultValue passado pelo caller).
func (c *Config) Reset(key string) error {
	c.mu.Lock()
	delete(c.data, key)
	c.mu.Unlock()
	c.scheduleSave()
	if c.ctx != nil {
		wruntime.EventsEmit(c.ctx, "config.changed", map[string]any{
			"key":   key,
			"value": nil,
		})
	}
	return nil
}

// OpenSettingsJson emite "editor.openFile" para o frontend abrir o settings.json
// no próprio editor do IDE (App.tsx escuta esse evento).
func (c *Config) OpenSettingsJson() error {
	if c.path == "" {
		return nil
	}
	// Garante que o arquivo existe antes de pedir pra abrir.
	if _, err := os.Stat(c.path); os.IsNotExist(err) {
		c.flush()
	}
	if c.ctx != nil {
		wruntime.EventsEmit(c.ctx, "editor.openFile", c.path)
	}
	return nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func settingsFilePath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "adila")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "settings.json"), nil
}
