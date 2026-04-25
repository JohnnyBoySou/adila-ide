package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	watcher     fileWatcher
	initialPath string
	cfg         *Config
}

func NewApp(cfg *Config) *App {
	return &App{cfg: cfg}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// SetInitialPath define a pasta a ser aberta no startup (vinda da CLI).
func (a *App) SetInitialPath(path string) {
	a.initialPath = path
}

// GetInitialPath retorna a pasta passada via CLI, ou string vazia.
// O frontend prioriza este valor sobre a sessão salva.
func (a *App) GetInitialPath() string {
	return a.initialPath
}

// cliInstallPath retorna o destino padrão da CLI: ~/.local/bin/adila.
func (a *App) cliInstallPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".local", "bin", "adila"), nil
}

// IsCLIInstalled retorna true se ~/.local/bin/adila existe.
func (a *App) IsCLIInstalled() bool {
	p, err := a.cliInstallPath()
	if err != nil {
		return false
	}
	_, err = os.Stat(p)
	return err == nil
}

// InstallCLI escreve um launcher bash em ~/.local/bin/adila que execa o
// binário atual em background. O caminho do binário é resolvido no momento da
// instalação via os.Executable() — assim funciona tanto em dev quanto após
// um wails build.
func (a *App) InstallCLI() error {
	target, err := a.cliInstallPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return err
	}
	binary, err := os.Executable()
	if err != nil {
		return err
	}
	binary, err = filepath.EvalSymlinks(binary)
	if err != nil {
		return err
	}

	script := fmt.Sprintf(`#!/usr/bin/env bash
# Gerado pelo Adila IDE — abre o app numa pasta (default: cwd).
set -euo pipefail
target="${1:-.}"
if [ ! -d "$target" ]; then
  echo "adila: '$target' não é um diretório" >&2
  exit 1
fi
abs="$(cd "$target" && pwd)"
bin=%q
if command -v setsid >/dev/null 2>&1; then
  setsid -f "$bin" "$abs" </dev/null >/dev/null 2>&1 || \
    setsid "$bin" "$abs" </dev/null >/dev/null 2>&1 &
else
  nohup "$bin" "$abs" </dev/null >/dev/null 2>&1 &
fi
disown 2>/dev/null || true
`, binary)

	return os.WriteFile(target, []byte(script), 0o755)
}

// UninstallCLI remove ~/.local/bin/adila se existir. No-op se já não existe.
func (a *App) UninstallCLI() error {
	target, err := a.cliInstallPath()
	if err != nil {
		return err
	}
	if _, err := os.Stat(target); os.IsNotExist(err) {
		return nil
	}
	return os.Remove(target)
}

// WatchRoot começa a observar path por mudanças no sistema de arquivos.
// Emite o evento "fileTree.changed" para o frontend após burst de 400 ms.
func (a *App) WatchRoot(path string) {
	a.watcher.watch(a.ctx, path)
}

type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
}

func (a *App) OpenFolderDialog() (string, error) {
	return wruntime.OpenDirectoryDialog(a.ctx, wruntime.OpenDialogOptions{
		Title: "Selecione uma pasta",
	})
}

// ListDir lista um diretório ocultando dotfiles e ordenando dirs primeiro.
// Usa Schwartzian transform para computar lowercase uma só vez (O(n) em vez de O(n log n)).
func (a *App) ListDir(path string) ([]FileEntry, error) {
	defer bench.Time("App.ListDir")()
	if path == "" {
		return nil, errors.New("caminho vazio")
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	type sortable struct {
		FileEntry
		lower string
	}

	exc := resolveExcludeFolders(a.cfg)

	named := make([]sortable, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		if e.IsDir() && exc[name] {
			continue
		}
		named = append(named, sortable{
			FileEntry: FileEntry{Name: name, Path: filepath.Join(path, name), IsDir: e.IsDir()},
			lower:     strings.ToLower(name),
		})
	}

	slices.SortFunc(named, func(a, b sortable) int {
		if a.IsDir != b.IsDir {
			if a.IsDir {
				return -1
			}
			return 1
		}
		return strings.Compare(a.lower, b.lower)
	})

	out := make([]FileEntry, len(named))
	for i, n := range named {
		out[i] = n.FileEntry
	}
	return out, nil
}

func (a *App) ReadFile(path string) (string, error) {
	defer bench.Time("App.ReadFile")()
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) WriteFile(path string, content string) error {
	defer bench.Time("App.WriteFile")()
	return os.WriteFile(path, []byte(content), 0o644)
}

func (a *App) CreateFile(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return err
	}
	return f.Close()
}

func (a *App) CreateDir(path string) error {
	return os.MkdirAll(path, 0o755)
}

func (a *App) RenameEntry(oldPath, newPath string) error {
	if oldPath == "" || newPath == "" {
		return errors.New("caminho vazio")
	}
	return os.Rename(oldPath, newPath)
}

func (a *App) DeleteEntry(path string) error {
	if path == "" {
		return errors.New("caminho vazio")
	}
	return os.RemoveAll(path)
}

// defaultExcludeFolders é a lista padrão de diretórios ocultos do file
// explorer e da indexação. Pode ser sobrescrita pelo usuário via config
// "explorer.excludeFolders".
var defaultExcludeFolders = []string{
	".git", ".svn", ".hg",
	"node_modules", "vendor",
	"dist", "build", "out",
	"target", ".next", ".nuxt",
	"coverage", "__pycache__",
	".cache", ".gradle",
	".turbo", ".parcel-cache",
}

// resolveExcludeFolders lê a lista efetiva de diretórios ignorados a
// partir do Config; se a chave não existir ou estiver vazia, retorna o
// default. Aceita tanto []any (vindo do JSON) quanto []string.
func resolveExcludeFolders(cfg *Config) map[string]bool {
	build := func(items []string) map[string]bool {
		m := make(map[string]bool, len(items))
		for _, s := range items {
			if s = strings.TrimSpace(s); s != "" {
				m[s] = true
			}
		}
		return m
	}
	if cfg != nil {
		raw := cfg.Get("explorer.excludeFolders", nil)
		switch v := raw.(type) {
		case []any:
			items := make([]string, 0, len(v))
			for _, x := range v {
				if s, ok := x.(string); ok {
					items = append(items, s)
				}
			}
			if len(items) > 0 {
				return build(items)
			}
		case []string:
			if len(v) > 0 {
				return build(v)
			}
		}
	}
	return build(defaultExcludeFolders)
}

// SearchFiles busca arquivos cujo nome contenha query sob rootPath.
//
// Estratégia de performance:
//   - Enumera subdiretórios top-level e distribui o walk entre goroutines,
//     uma por subdir, limitadas por um semáforo de tamanho runtime.NumCPU().
//   - Resultados fluem por um canal bufferizado; a goroutine principal coleta
//     até maxResults e cancela as demais via context.
//   - Diretórios em ignoreDirs e dotdirs são pulados inteiramente (SkipDir).
//
// Essa abordagem é eficaz em SSDs e filesystems em rede; em HDDs o ganho é
// menor (seek penalty), mas a lista de ignorados já economiza muito I/O.
// asciiToLower retorna o byte em minúsculo para A-Z; demais bytes inalterados.
// Inline para o hot path do containsFold.
func asciiToLower(b byte) byte {
	if b >= 'A' && b <= 'Z' {
		return b + 32
	}
	return b
}

// containsFoldASCII verifica se s contém substr ignorando case, sem alocar.
// Para queries não-ASCII, faz fallback para strings.ToLower (raro em filenames).
// substr DEVE estar pré-lowercased pelo caller.
func containsFoldASCII(s, lowerSubstr string) bool {
	n := len(lowerSubstr)
	if n == 0 {
		return true
	}
	if len(s) < n {
		return false
	}
	for i := 0; i <= len(s)-n; i++ {
		ok := true
		for j := 0; j < n; j++ {
			if asciiToLower(s[i+j]) != lowerSubstr[j] {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}

func (a *App) SearchFiles(rootPath, query string) ([]FileEntry, error) {
	defer bench.Time("App.SearchFiles")()
	const maxResults = 200

	if rootPath == "" || query == "" {
		return nil, nil
	}
	q := strings.ToLower(query)
	exc := resolveExcludeFolders(a.cfg)

	ctx, cancel := context.WithCancel(a.ctx)
	defer cancel()

	// Semáforo para limitar workers a N goroutines simultâneas.
	numWorkers := runtime.NumCPU()
	if numWorkers < 2 {
		numWorkers = 2
	}
	sem := make(chan struct{}, numWorkers)

	type batch []FileEntry
	ch := make(chan batch, numWorkers*2)

	var wg sync.WaitGroup

	// walkDir percorre um único diretório-raiz e envia resultados em lote.
	walkDir := func(dir string) {
		defer wg.Done()
		// Adquire slot no semáforo — bloqueia se já houver numWorkers workers ativos.
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			return
		}
		defer func() { <-sem }()

		var buf batch
		_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, walkErr error) error {
			// Checa cancelamento a cada entrada, sem custo relevante.
			select {
			case <-ctx.Done():
				return filepath.SkipAll
			default:
			}
			if walkErr != nil {
				return nil
			}
			name := d.Name()
			if strings.HasPrefix(name, ".") || (d.IsDir() && exc[name]) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if containsFoldASCII(name, q) {
				buf = append(buf, FileEntry{Name: name, Path: path, IsDir: d.IsDir()})
			}
			return nil
		})

		if len(buf) == 0 {
			return
		}
		select {
		case ch <- buf:
		case <-ctx.Done():
		}
	}

	// Lê as entradas do diretório raiz para fazer o fan-out.
	topEntries, err := os.ReadDir(rootPath)
	if err != nil {
		return nil, err
	}

	var results []FileEntry

	for _, e := range topEntries {
		name := e.Name()
		if strings.HasPrefix(name, ".") || exc[name] {
			continue
		}
		// Arquivo/dir no nível raiz que já casa com a query.
		if containsFoldASCII(name, q) {
			results = append(results, FileEntry{Name: name, Path: filepath.Join(rootPath, name), IsDir: e.IsDir()})
		}
		if !e.IsDir() {
			continue
		}
		wg.Add(1)
		go walkDir(filepath.Join(rootPath, name))
	}

	// Fecha o canal quando todos os workers terminarem.
	go func() {
		wg.Wait()
		close(ch)
	}()

	// Coleta lotes de resultados; cancela workers quando limite for atingido.
	for b := range ch {
		results = append(results, b...)
		if len(results) >= maxResults {
			cancel()
			// Drena o canal para liberar goroutines que estão bloqueadas no send.
			for range ch {
			}
			break
		}
	}

	if len(results) > maxResults {
		results = results[:maxResults]
	}
	return results, nil
}
