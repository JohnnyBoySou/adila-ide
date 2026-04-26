package main

import (
	"fmt"
	"testing"
)

// makeQueries gera N ConfigQuery sintéticas pra simular cargas como a do
// useEditorConfig (30+ chaves) ou App.tsx (7 chaves).
func makeQueries(n int) []ConfigQuery {
	out := make([]ConfigQuery, n)
	for i := 0; i < n; i++ {
		out[i] = ConfigQuery{
			Key:          fmt.Sprintf("editor.option.%d", i),
			DefaultValue: i,
		}
	}
	return out
}

// preencheConfigData injeta valores no Config global pra simular um settings.json
// já carregado. fillRatio em [0,1] define a fração de chaves resolvidas no global.
func preencheConfigData(c *Config, queries []ConfigQuery, fillRatio float64) {
	cutoff := int(float64(len(queries)) * fillRatio)
	c.mu.Lock()
	for i := 0; i < cutoff; i++ {
		c.data[queries[i].Key] = "global-value"
	}
	c.mu.Unlock()
}

// preencheWorkspaceData injeta valores no WorkspaceConfig pra simular um
// .adila/settings.json com algumas chaves sobrescritas.
func preencheWorkspaceData(w *WorkspaceConfig, queries []ConfigQuery, count int) {
	w.mu.Lock()
	w.path = "/tmp/fake-workspace/.adila/settings.json"
	for i := 0; i < count && i < len(queries); i++ {
		w.data[queries[i].Key] = "ws-value"
	}
	w.mu.Unlock()
}

func BenchmarkConfigGetMany_NoWorkspace_30keys(b *testing.B) {
	cfg := NewConfig()
	queries := makeQueries(30)
	preencheConfigData(cfg, queries, 0.8)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = cfg.GetMany(queries)
	}
}

func BenchmarkConfigGetMany_WithWorkspace_30keys(b *testing.B) {
	cfg := NewConfig()
	wcfg := NewWorkspaceConfig()
	cfg.AttachWorkspace(wcfg)
	queries := makeQueries(30)
	preencheConfigData(cfg, queries, 0.8)
	preencheWorkspaceData(wcfg, queries, 5)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = cfg.GetMany(queries)
	}
}

func BenchmarkConfigGetMany_WithEmptyWorkspace_30keys(b *testing.B) {
	cfg := NewConfig()
	wcfg := NewWorkspaceConfig()
	cfg.AttachWorkspace(wcfg)
	queries := makeQueries(30)
	preencheConfigData(cfg, queries, 0.8)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = cfg.GetMany(queries)
	}
}

func BenchmarkConfigGet_WithWorkspace(b *testing.B) {
	cfg := NewConfig()
	wcfg := NewWorkspaceConfig()
	cfg.AttachWorkspace(wcfg)
	queries := makeQueries(30)
	preencheConfigData(cfg, queries, 0.8)
	preencheWorkspaceData(wcfg, queries, 5)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = cfg.Get("editor.option.10", nil)
	}
}
