package main

import (
	"context"
	"encoding/hex"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/cespare/xxhash/v2"
	ts "github.com/tree-sitter/go-tree-sitter"
)

// Symbol é o registro exposto ao frontend (também é o que persiste no DB,
// modulo o file_id). As tags JSON definem o shape consumido pelo TS.
type Symbol struct {
	Name      string `json:"name"`
	Kind      string `json:"kind"`
	Scope     string `json:"scope,omitempty"`
	Path      string `json:"path"`
	Line      int    `json:"line"`
	Col       int    `json:"col"`
	EndLine   int    `json:"endLine"`
	Signature string `json:"signature,omitempty"`
}

// IndexerStatus é o estado bruto consumido pela status bar. Contadores são
// atomic.Int64 internamente; aqui já viajam como int normal.
type IndexerStatus struct {
	Indexing bool   `json:"indexing"`
	Indexed  int    `json:"indexed"`
	Total    int    `json:"total"`
	Workdir  string `json:"workdir"`
	DbPath   string `json:"dbPath"`
}

// indexerLazyDelay define quanto tempo aguardamos depois do SetWorkdir
// antes de sair indexando. Suficiente pra primeira pintura da árvore de
// arquivos terminar.
const indexerLazyDelay = 2 * time.Second

// indexerDefaultMaxFileSize é o fallback quando a config indexer.maxFileSize
// não está setada. 1 MiB cobre 99% do código real e descarta vendor bundles
// minified.
const indexerDefaultMaxFileSize int64 = 1 << 20

// indexerProgressEvery controla a frequência de eventos indexer.progress
// — granular o suficiente pra animar a status bar sem inundar o frontend.
const indexerProgressEvery = 50

// Indexer é o service registrado no application.New. Ele guarda o DB do
// workspace ativo, pools de parsers tree-sitter (um por linguagem) e o
// estado de progresso observável pelo frontend.
type Indexer struct {
	ctx    context.Context
	config *Config

	mu      sync.Mutex
	db      *indexerDB
	workdir string

	poolMu sync.Mutex
	pools  map[string]*parserPool // lang id → pool, lazy

	// scheduling
	scheduleCancel context.CancelFunc

	// progress (atomic pra leitura sem lock)
	indexing atomic.Bool
	indexed  atomic.Int64
	total    atomic.Int64
}

func NewIndexer(cfg *Config) *Indexer {
	return &Indexer{config: cfg, pools: map[string]*parserPool{}}
}

// poolFor devolve o parserPool da linguagem, criando-o na primeira chamada.
// Cada parserPool é específico do *ts.Language correspondente, então não
// dá pra reaproveitar entre TS/TSX (mesma binding, grammars distintas).
func (i *Indexer) poolFor(langID string) (*langSpec, *parserPool, error) {
	spec, err := getLangSpec(langID)
	if err != nil {
		return nil, nil, err
	}
	i.poolMu.Lock()
	defer i.poolMu.Unlock()
	if p, ok := i.pools[langID]; ok {
		return spec, p, nil
	}
	p := newParserPool(spec.language)
	i.pools[langID] = p
	return spec, p, nil
}

func (i *Indexer) startup(ctx context.Context) {
	i.ctx = ctx
	// Subscreve o evento global do watcher do projeto. Ele já é debounced
	// em 400ms na origem; aqui adicionamos outro debounce de 600ms pra
	// coalescer rajadas (ex.: git switch trocando dezenas de arquivos).
	go i.watchLoop(ctx)
}

func (i *Indexer) shutdown(_ context.Context) {
	i.mu.Lock()
	defer i.mu.Unlock()
	if i.scheduleCancel != nil {
		i.scheduleCancel()
		i.scheduleCancel = nil
	}
	if i.db != nil {
		_ = i.db.Close()
		i.db = nil
	}
}

// SetWorkdir é chamado pelo App quando o usuário troca de projeto.
// Reabre o DB e dispara um reindex lazy (debounced em indexerLazyDelay) pra
// não competir com o paint inicial da UI. Idempotente: chamadas repetidas
// pra o mesmo workdir só re-armam o timer.
func (i *Indexer) SetWorkdir(workdir string) error {
	workdir = strings.TrimSpace(workdir)
	i.mu.Lock()
	if workdir == i.workdir && i.db != nil {
		i.mu.Unlock()
		return nil
	}
	if i.scheduleCancel != nil {
		i.scheduleCancel()
		i.scheduleCancel = nil
	}
	if i.db != nil {
		_ = i.db.Close()
		i.db = nil
	}
	i.workdir = workdir
	if workdir == "" {
		i.mu.Unlock()
		return nil
	}
	db, err := openIndexerDB(workdir)
	if err != nil {
		i.mu.Unlock()
		logErrorf("indexer: abrir DB: %v", err)
		return err
	}
	i.db = db
	ctx, cancel := context.WithCancel(i.ctx)
	i.scheduleCancel = cancel
	i.mu.Unlock()
	go i.scheduleReindex(ctx)
	return nil
}

// scheduleReindex roda numa goroutine de fundo. O sleep inicial é o "lazy"
// — qualquer SetWorkdir subsequente cancela o ctx e reagenda.
func (i *Indexer) scheduleReindex(ctx context.Context) {
	select {
	case <-ctx.Done():
		return
	case <-time.After(indexerLazyDelay):
	}
	if err := i.runIndex(ctx, false); err != nil && !errors.Is(err, context.Canceled) {
		logErrorf("indexer: %v", err)
	}
}

// watchLoop assina "fileTree.changed" (emitido pelo watcher.go quando algo
// muda no workdir) e dispara incrementalSync com debounce. O loop vive
// pelo tempo todo do app — sai quando o ctx do startup é cancelado.
func (i *Indexer) watchLoop(ctx context.Context) {
	const debounce = 600 * time.Millisecond
	dirty := make(chan struct{}, 1)
	off := onEvent("fileTree.changed", func(_ ...any) {
		select {
		case dirty <- struct{}{}:
		default:
			// Já tem um sinal pendente — coalescemos.
		}
	})
	defer off()

	var timer *time.Timer
	for {
		select {
		case <-ctx.Done():
			if timer != nil {
				timer.Stop()
			}
			return
		case <-dirty:
			if timer != nil {
				timer.Stop()
			}
			timer = time.AfterFunc(debounce, func() {
				if err := i.incrementalSync(ctx); err != nil && !errors.Is(err, context.Canceled) {
					logErrorf("indexer.sync: %v", err)
				}
			})
		}
	}
}

// incrementalSync caminha o workdir comparando mtime/hash com o DB.
// Re-indexa apenas o que mudou e remove arquivos que sumiram do disco.
// Mais barato que runIndex(false) porque pula o cleanup do indexed counter
// e não emite progress per-file (a UX só precisa do "ready" final).
func (i *Indexer) incrementalSync(ctx context.Context) error {
	i.mu.Lock()
	db := i.db
	root := i.workdir
	i.mu.Unlock()
	if db == nil || root == "" {
		return nil
	}
	// Se uma indexação inicial estiver rolando, deixa ela terminar — vai
	// pegar tudo de qualquer forma.
	if i.indexing.Load() {
		return nil
	}
	if !i.isEnabled() {
		return nil
	}
	if !i.indexing.CompareAndSwap(false, true) {
		return nil
	}
	defer i.indexing.Store(false)

	exclude := excludeSet(loadConfigStringList(i.cfg(), "explorer.excludeFolders"))
	paths, err := collectIndexablePaths(root, exclude)
	if err != nil {
		return err
	}

	// 1) Detecta arquivos novos/modificados via stat + hash skip dentro do
	// indexFileLocked. Re-roda em todos: o hash skip faz o curto-circuito
	// pra arquivos inalterados e o overhead de stat é desprezível.
	for _, p := range paths {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		i.indexFileLocked(db, p)
	}

	// 2) Detecta deleções: paths que estão no DB mas não vieram do walker.
	known := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		known[p] = struct{}{}
	}
	allDB, err := db.allFilePaths()
	if err == nil {
		for _, p := range allDB {
			if _, ok := known[p]; !ok {
				_ = db.removeFile(p)
			}
		}
	}

	emit("indexer.changed", map[string]any{
		"workdir": root,
		"total":   len(paths),
	})
	return nil
}

// runIndex caminha pela árvore, dispara workers e atualiza o DB. force=true
// limpa o DB antes (usado pelo Reindex).
func (i *Indexer) runIndex(ctx context.Context, force bool) error {
	i.mu.Lock()
	db := i.db
	root := i.workdir
	i.mu.Unlock()
	if db == nil || root == "" {
		return nil
	}
	if !i.indexing.CompareAndSwap(false, true) {
		// Já existe uma indexação em curso — não vamos abrir uma segunda.
		return nil
	}
	defer i.indexing.Store(false)

	if !i.isEnabled() {
		// Usuário desligou o indexer; não toca no DB existente nem agenda
		// novo trabalho. Reabilitar passa a indexar de novo na próxima
		// chamada (Reindex/SetWorkdir/fileTree.changed).
		return nil
	}

	if force {
		if err := db.resetAll(); err != nil {
			return err
		}
	}

	// 1ª passada: coleta caminhos elegíveis (rápida, single-thread).
	exclude := excludeSet(loadConfigStringList(i.cfg(), "explorer.excludeFolders"))
	paths, err := collectIndexablePaths(root, exclude)
	if err != nil {
		return err
	}
	i.indexed.Store(0)
	i.total.Store(int64(len(paths)))
	emit("indexer.progress", map[string]any{"indexed": 0, "total": len(paths)})

	// 2ª passada: parse em N workers. NumCPU/2 com mínimo 2 deixa headroom
	// pra gopls/vite/etc continuarem responsivos durante a indexação inicial.
	workers := runtime.NumCPU() / 2
	if workers < 2 {
		workers = 2
	}
	jobs := make(chan string, len(paths))
	for _, p := range paths {
		jobs <- p
	}
	close(jobs)

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case p, ok := <-jobs:
					if !ok {
						return
					}
					i.indexFileLocked(db, p)
					n := int(i.indexed.Add(1))
					if n%indexerProgressEvery == 0 || int64(n) == i.total.Load() {
						emit("indexer.progress", map[string]any{
							"indexed": n,
							"total":   int(i.total.Load()),
						})
					}
				}
			}
		}()
	}
	wg.Wait()

	if ctx.Err() == nil {
		emit("indexer.ready", map[string]any{
			"indexed": int(i.indexed.Load()),
			"total":   int(i.total.Load()),
			"workdir": root,
		})
	}
	return ctx.Err()
}

// indexFileLocked é tolerante a erros: qualquer falha vira log e o arquivo é
// pulado. Não queremos abortar a indexação inteira por causa de um único
// arquivo malformado.
func (i *Indexer) indexFileLocked(db *indexerDB, path string) {
	lang := detectLanguage(path)
	if lang == "" {
		return
	}
	info, err := os.Stat(path)
	if err != nil || info.Size() > i.maxFileSize() || info.IsDir() {
		return
	}
	src, err := os.ReadFile(path)
	if err != nil {
		return
	}
	if isLikelyBinary(src) {
		return
	}
	hash := hashBytes(src)

	// Skip se hash bate com o que está no DB (arquivo inalterado).
	prev, err := db.getFile(path)
	if err == nil && prev != nil && prev.hash == hash {
		return
	}

	spec, pool, err := i.poolFor(lang)
	if err != nil {
		return
	}
	parser := pool.get()
	defer pool.put(parser)
	syms, err := extractSymbols(spec, parser, src)
	if err != nil {
		return
	}
	_ = db.upsertFileWithSymbols(path, lang, hash, info.ModTime().Unix(), info.Size(), syms)
}

// ── Frontend API ─────────────────────────────────────────────────────────

func (i *Indexer) GetStatus() IndexerStatus {
	i.mu.Lock()
	root := i.workdir
	dbPath := ""
	if i.db != nil {
		dbPath = i.db.path
	}
	i.mu.Unlock()
	return IndexerStatus{
		Indexing: i.indexing.Load(),
		Indexed:  int(i.indexed.Load()),
		Total:    int(i.total.Load()),
		Workdir:  root,
		DbPath:   dbPath,
	}
}

func (i *Indexer) SearchSymbols(query string, limit int) []Symbol {
	i.mu.Lock()
	db := i.db
	i.mu.Unlock()
	if db == nil || strings.TrimSpace(query) == "" {
		return []Symbol{}
	}
	syms, err := db.searchSymbols(strings.TrimSpace(query), limit)
	if err != nil {
		logErrorf("indexer.SearchSymbols: %v", err)
		return []Symbol{}
	}
	return syms
}

func (i *Indexer) SymbolsForFile(path string) []Symbol {
	i.mu.Lock()
	db := i.db
	i.mu.Unlock()
	if db == nil {
		return []Symbol{}
	}
	syms, err := db.symbolsForFile(path)
	if err != nil {
		logErrorf("indexer.SymbolsForFile: %v", err)
		return []Symbol{}
	}
	return syms
}

// Reindex limpa o DB e reindexa do zero. Chamado por ação manual no
// SettingsView ou após mudar configurações que afetam exclusões.
func (i *Indexer) Reindex() error {
	i.mu.Lock()
	if i.scheduleCancel != nil {
		i.scheduleCancel()
	}
	ctx, cancel := context.WithCancel(i.ctx)
	i.scheduleCancel = cancel
	i.mu.Unlock()
	go func() {
		_ = i.runIndex(ctx, true)
	}()
	return nil
}

// cfg devolve o Config injetado no construtor. Ponteiro nil é tolerado em
// todas as leituras (loadConfigStringList já trata).
func (i *Indexer) cfg() *Config { return i.config }

// isEnabled lê a chave indexer.enabled do Config. Default true.
func (i *Indexer) isEnabled() bool {
	if i.config == nil {
		return true
	}
	v := i.config.Get("indexer.enabled", true)
	if b, ok := v.(bool); ok {
		return b
	}
	return true
}

// maxFileSize lê indexer.maxFileSize do Config (em bytes). Faz coerção
// defensiva: o JSON sempre devolve float64 pra números, então convertemos.
// Valores <= 0 ou ausentes caem no default.
func (i *Indexer) maxFileSize() int64 {
	if i.config == nil {
		return indexerDefaultMaxFileSize
	}
	v := i.config.Get("indexer.maxFileSize", float64(indexerDefaultMaxFileSize))
	switch x := v.(type) {
	case float64:
		if x <= 0 {
			return indexerDefaultMaxFileSize
		}
		return int64(x)
	case int:
		if x <= 0 {
			return indexerDefaultMaxFileSize
		}
		return int64(x)
	case int64:
		if x <= 0 {
			return indexerDefaultMaxFileSize
		}
		return x
	}
	return indexerDefaultMaxFileSize
}

// ── helpers ──────────────────────────────────────────────────────────────

// indexerExcludes default — extras vêm do settings explorer.excludeFolders.
var indexerDefaultExcludes = []string{
	"node_modules",
	".git",
	"dist",
	"build",
	"target",
	"vendor",
	".next",
	".cache",
	"__pycache__",
}

func excludeSet(extra []string) map[string]struct{} {
	out := make(map[string]struct{}, len(indexerDefaultExcludes)+len(extra))
	for _, d := range indexerDefaultExcludes {
		out[d] = struct{}{}
	}
	for _, d := range extra {
		d = strings.TrimSpace(d)
		if d != "" {
			out[d] = struct{}{}
		}
	}
	return out
}

// collectIndexablePaths caminha pela árvore retornando só arquivos com
// linguagem suportada, ignorando dirs do exclude set, dotfiles top-level
// e bin/lock comuns.
func collectIndexablePaths(root string, exclude map[string]struct{}) ([]string, error) {
	var out []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // tolera leitura de subdir negada
		}
		name := d.Name()
		if d.IsDir() {
			if path == root {
				return nil
			}
			if _, skip := exclude[name]; skip {
				return filepath.SkipDir
			}
			if strings.HasPrefix(name, ".") {
				return filepath.SkipDir
			}
			return nil
		}
		if detectLanguage(name) == "" {
			return nil
		}
		out = append(out, path)
		return nil
	})
	return out, err
}

// hashBytes usa xxhash64 (rápido, não-criptográfico) — suficiente pra
// detectar mudança de conteúdo entre runs.
func hashBytes(b []byte) string {
	h := xxhash.Sum64(b)
	return hex.EncodeToString([]byte{
		byte(h >> 56), byte(h >> 48), byte(h >> 40), byte(h >> 32),
		byte(h >> 24), byte(h >> 16), byte(h >> 8), byte(h),
	})
}

// isLikelyBinary olha os primeiros 8KB e marca como binário se houver NUL
// — heurística simples mas eficaz pra texto/UTF-8.
func isLikelyBinary(b []byte) bool {
	limit := len(b)
	if limit > 8192 {
		limit = 8192
	}
	for i := 0; i < limit; i++ {
		if b[i] == 0 {
			return true
		}
	}
	return false
}

// loadConfigStringList lê uma chave do Config como []string, tolerante a
// nil/null/string-list-vazia.
func loadConfigStringList(cfg *Config, key string) []string {
	if cfg == nil {
		return nil
	}
	raw := cfg.Get(key, []any{})
	arr, ok := raw.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, v := range arr {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// silenciar warning do tree-sitter import quando não há fluxo de runtime
// referenciando ts diretamente (mantemos só a referência abaixo pra
// garantir que o import permanece após edits).
var _ = ts.NewParser
