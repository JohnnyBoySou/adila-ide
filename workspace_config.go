package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// WorkspaceConfig persiste configurações específicas do projeto em
// <workdir>/.adila/settings.json. Estrutura igual à do Config global
// (debounce + flush em shutdown), mas atrelada ao workdir corrente.
//
// Sem workdir definido todas as operações operam em memória sem nunca
// tocar em disco — Set é silencioso, Get devolve apenas defaults.
type WorkspaceConfig struct {
	ctx     context.Context
	mu      sync.RWMutex
	workdir string
	path    string
	data    map[string]any
	saveCh  chan struct{}
}

func NewWorkspaceConfig() *WorkspaceConfig {
	return &WorkspaceConfig{
		data:   make(map[string]any),
		saveCh: make(chan struct{}, 1),
	}
}

func (w *WorkspaceConfig) startup(ctx context.Context) {
	w.ctx = ctx
	go w.saveLoop()
}

func (w *WorkspaceConfig) shutdown(_ context.Context) {
	w.flush()
}

// SetWorkdir troca o workspace ativo, recarregando do disco. Se path == ""
// o estado é zerado e nada será persistido até um novo SetWorkdir.
//
// Emite config.changed para cada chave cujo valor efetivo possa ter mudado:
// união entre as chaves do workspace anterior e do novo. Isso permite que
// serviços que escutam config.changed (ex: Git.autoFetch) revalidem.
func (w *WorkspaceConfig) SetWorkdir(path string) {
	w.mu.Lock()
	if w.workdir == path {
		w.mu.Unlock()
		return
	}
	prev := make(map[string]bool, len(w.data))
	for k := range w.data {
		prev[k] = true
	}
	w.workdir = path
	if path == "" {
		w.path = ""
		w.data = make(map[string]any)
	} else {
		w.path = filepath.Join(path, ".adila", "settings.json")
		w.data = make(map[string]any)
		w.loadLocked()
	}
	affected := make(map[string]any, len(w.data)+len(prev))
	for k, v := range w.data {
		affected[k] = v
	}
	for k := range prev {
		if _, ok := affected[k]; !ok {
			affected[k] = nil
		}
	}
	w.mu.Unlock()
	if w.ctx != nil {
		emit("workspaceConfig.changed", map[string]any{
			"key":   "*",
			"value": nil,
		})
		for k, v := range affected {
			emit("config.changed", map[string]any{
				"key":   k,
				"value": v,
			})
		}
	}
}

func (w *WorkspaceConfig) loadLocked() {
	if w.path == "" {
		return
	}
	raw, err := os.ReadFile(w.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(raw, &w.data)
}

func (w *WorkspaceConfig) flush() {
	w.mu.RLock()
	if w.path == "" {
		w.mu.RUnlock()
		return
	}
	snap := make(map[string]any, len(w.data))
	for k, v := range w.data {
		snap[k] = v
	}
	path := w.path
	w.mu.RUnlock()

	b, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	_ = os.WriteFile(path, b, 0o644)
}

func (w *WorkspaceConfig) saveLoop() {
	const debounce = 400 * time.Millisecond
	timer := time.NewTimer(debounce)
	timer.Stop()
	for {
		select {
		case <-w.saveCh:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timer.Reset(debounce)
		case <-timer.C:
			w.flush()
		case <-w.ctx.Done():
			w.flush()
			return
		}
	}
}

func (w *WorkspaceConfig) scheduleSave() {
	select {
	case w.saveCh <- struct{}{}:
	default:
	}
}

// Get devolve o valor para key ou defaultValue se ausente.
func (w *WorkspaceConfig) Get(key string, defaultValue any) any {
	defer bench.Time("WorkspaceConfig.Get")()
	w.mu.RLock()
	v, ok := w.data[key]
	w.mu.RUnlock()
	if !ok {
		return defaultValue
	}
	return v
}

// Lookup devolve o valor armazenado e se a chave existe — usado pelo Config
// global pra resolução em camadas (workspace sobrescreve global).
func (w *WorkspaceConfig) Lookup(key string) (any, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if w.path == "" {
		return nil, false
	}
	v, ok := w.data[key]
	return v, ok
}

// fillMany preenche out[i] e marca resolved[i]=true para cada query cuja
// chave existe no workspace. 1 RLock cobre todas as N consultas — usado
// pelo Config.GetMany para evitar N acquisições no workspace.
func (w *WorkspaceConfig) fillMany(queries []ConfigQuery, out []any, resolved []bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if w.path == "" || len(w.data) == 0 {
		return
	}
	for i, q := range queries {
		if v, ok := w.data[q.Key]; ok {
			out[i] = v
			resolved[i] = true
		}
	}
}

func (w *WorkspaceConfig) GetMany(queries []ConfigQuery) []any {
	defer bench.Time("WorkspaceConfig.GetMany")()
	out := make([]any, len(queries))
	w.mu.RLock()
	for i, q := range queries {
		if v, ok := w.data[q.Key]; ok {
			out[i] = v
		} else {
			out[i] = q.DefaultValue
		}
	}
	w.mu.RUnlock()
	return out
}

func (w *WorkspaceConfig) Set(key string, value any) error {
	defer bench.Time("WorkspaceConfig.Set")()
	w.mu.Lock()
	if w.path == "" {
		w.mu.Unlock()
		return errors.New("nenhum workspace aberto")
	}
	w.data[key] = value
	w.mu.Unlock()
	w.scheduleSave()
	if w.ctx != nil {
		payload := map[string]any{"key": key, "value": value}
		emit("workspaceConfig.changed", payload)
		// Espelha em config.changed pra que serviços escutando config global
		// também revalidem (resolução em camadas é transparente pra eles).
		emit("config.changed", payload)
	}
	return nil
}

func (w *WorkspaceConfig) Reset(key string) error {
	defer bench.Time("WorkspaceConfig.Reset")()
	w.mu.Lock()
	if w.path == "" {
		w.mu.Unlock()
		return nil
	}
	delete(w.data, key)
	w.mu.Unlock()
	w.scheduleSave()
	if w.ctx != nil {
		payload := map[string]any{"key": key, "value": nil}
		emit("workspaceConfig.changed", payload)
		emit("config.changed", payload)
	}
	return nil
}

// OpenSettingsJson cria o arquivo se necessário e pede pro frontend abrir.
func (w *WorkspaceConfig) OpenSettingsJson() error {
	w.mu.RLock()
	path := w.path
	w.mu.RUnlock()
	if path == "" {
		return errors.New("nenhum workspace aberto")
	}
	if _, err := os.Stat(path); os.IsNotExist(err) {
		w.flush()
	}
	if w.ctx != nil {
		emit("editor.openFile", path)
	}
	return nil
}
