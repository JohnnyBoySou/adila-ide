package main

import (
	"context"
	"errors"
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
	ctx     context.Context
	watcher fileWatcher
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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

	named := make([]sortable, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
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
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (a *App) WriteFile(path string, content string) error {
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

// ignoreDirs são diretórios sempre ignorados na busca — normalmente grandes e sem código-fonte.
var ignoreDirs = map[string]bool{
	".git": true, ".svn": true, ".hg": true,
	"node_modules": true, "vendor": true,
	"dist": true, "build": true, "out": true,
	"target": true, ".next": true, ".nuxt": true,
	"coverage": true, "__pycache__": true,
	".cache": true, ".gradle": true,
	".turbo": true, ".parcel-cache": true,
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
func (a *App) SearchFiles(rootPath, query string) ([]FileEntry, error) {
	const maxResults = 200

	if rootPath == "" || query == "" {
		return nil, nil
	}
	q := strings.ToLower(query)

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
			if strings.HasPrefix(name, ".") || (d.IsDir() && ignoreDirs[name]) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if strings.Contains(strings.ToLower(name), q) {
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
		if strings.HasPrefix(name, ".") || ignoreDirs[name] {
			continue
		}
		// Arquivo/dir no nível raiz que já casa com a query.
		if strings.Contains(strings.ToLower(name), q) {
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
