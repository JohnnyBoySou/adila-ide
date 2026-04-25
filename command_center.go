package main

import (
	"context"
	"io/fs"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type PaletteItem struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Detail      string `json:"detail,omitempty"`
	Hint        string `json:"hint,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

type CmdFileEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDirectory bool   `json:"isDirectory"`
	Mtime       int64  `json:"mtime,omitempty"`
}

type CommandCenter struct {
	ctx     context.Context
	mu      sync.RWMutex
	workdir string
	git     *Git
	cfg     *Config
}

func NewCommandCenter(git *Git, cfg *Config) *CommandCenter {
	return &CommandCenter{git: git, cfg: cfg}
}

func (c *CommandCenter) startup(ctx context.Context) {
	c.ctx = ctx
}

func (c *CommandCenter) SetWorkdir(path string) {
	c.mu.Lock()
	c.workdir = path
	c.mu.Unlock()
}

func (c *CommandCenter) GetWorkspaceRoots() []CmdFileEntry {
	c.mu.RLock()
	dir := c.workdir
	c.mu.RUnlock()
	if dir == "" {
		return []CmdFileEntry{}
	}
	return []CmdFileEntry{{Name: filepath.Base(dir), Path: dir, IsDirectory: true}}
}

const maxIndexFiles = 10_000

func (c *CommandCenter) ListAllFiles() []CmdFileEntry {
	c.mu.RLock()
	root := c.workdir
	c.mu.RUnlock()
	if root == "" {
		return []CmdFileEntry{}
	}

	// Fan-out: one goroutine per top-level entry.
	topEntries, err := filepath.Glob(filepath.Join(root, "*"))
	if err != nil || len(topEntries) == 0 {
		return []CmdFileEntry{}
	}

	numWorkers := runtime.NumCPU()
	if numWorkers < 2 {
		numWorkers = 2
	}
	sem := make(chan struct{}, numWorkers)
	batchCh := make(chan []CmdFileEntry, len(topEntries)+1)
	var wg sync.WaitGroup

	exc := resolveExcludeFolders(c.cfg)

	for _, entry := range topEntries {
		wg.Add(1)
		go func(p string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			var batch []CmdFileEntry
			_ = filepath.WalkDir(p, func(fp string, d fs.DirEntry, walkErr error) error {
				if walkErr != nil {
					return nil
				}
				if d.IsDir() {
					if exc[d.Name()] {
						return filepath.SkipDir
					}
					return nil
				}
				info, _ := d.Info()
				var mtime int64
				if info != nil {
					mtime = info.ModTime().Unix()
				}
				batch = append(batch, CmdFileEntry{Name: d.Name(), Path: fp, Mtime: mtime})
				return nil
			})
			batchCh <- batch
		}(entry)
	}

	go func() {
		wg.Wait()
		close(batchCh)
	}()

	var files []CmdFileEntry
	for batch := range batchCh {
		files = append(files, batch...)
		if len(files) >= maxIndexFiles {
			break
		}
	}
	// Drain to unblock any goroutine still waiting to send.
	for range batchCh {
	}

	if len(files) > maxIndexFiles {
		files = files[:maxIndexFiles]
	}
	return files
}

var builtinCommands = []PaletteItem{
	{ID: "openFolder", Title: "Abrir pasta...", Icon: "folder-opened", Hint: "Ctrl+O"},
	{ID: "newFile", Title: "Novo arquivo", Icon: "new-file"},
	{ID: "openSettingsJson", Title: "Abrir settings.json", Icon: "settings-gear"},
	{ID: "openSettings", Title: "Preferências: Abrir configurações", Icon: "settings", Hint: "Ctrl+,"},
	{ID: "openKeybindings", Title: "Preferências: Atalhos de teclado", Icon: "keyboard", Hint: "Ctrl+K Ctrl+S"},
	{ID: "openGitView", Title: "Source Control: Abrir Git", Icon: "source-control"},
	{ID: "openOnboarding", Title: "Boas-vindas: Abrir onboarding", Icon: "rocket"},
	{ID: "openAbout", Title: "Sobre Adila IDE", Icon: "info"},
	{ID: "openBenchView", Title: "Desenvolvedor: Abrir Benchmarks", Icon: "dashboard"},
	{ID: "toggleTerminal", Title: "Alternar terminal", Icon: "terminal", Hint: "Ctrl+`"},
	{ID: "toggleZen", Title: "Visualização: Alternar modo Zen", Icon: "screen-full", Hint: "Ctrl+K Z"},
	{ID: "openWebview", Title: "Webview: Abrir URL como aba", Icon: "globe", Hint: "Ctrl+Shift+U"},
	{ID: "git.stageAll", Title: "Git: Adicionar todos os arquivos", Icon: "diff-added"},
	{ID: "git.push", Title: "Git: Enviar (push)", Icon: "cloud-upload"},
	{ID: "reloadWindow", Title: "Recarregar janela", Icon: "refresh"},
}

func (c *CommandCenter) List(mode, query string) []PaletteItem {
	switch mode {
	case "commands":
		if query == "" {
			return builtinCommands
		}
		q := strings.ToLower(query)
		var out []PaletteItem
		for _, cmd := range builtinCommands {
			if strings.Contains(strings.ToLower(cmd.Title), q) {
				out = append(out, cmd)
			}
		}
		if out == nil {
			return []PaletteItem{}
		}
		return out
	case "help":
		return []PaletteItem{
			{ID: ">", Title: "Comandos", Description: "> filtrar comandos"},
			{ID: "@", Title: "Símbolos", Description: "@ ir para símbolo"},
			{ID: ":", Title: "Ir para linha", Description: ":42  ou  :42:10"},
		}
	default:
		return []PaletteItem{}
	}
}

func (c *CommandCenter) Execute(id string) error {
	switch id {
	case "openSettingsJson":
		return c.cfg.OpenSettingsJson()
	case "git.stageAll":
		return c.git.StageAll()
	case "git.push":
		return c.git.Push()
	case "reloadWindow":
		wruntime.WindowReload(c.ctx)
		return nil
	default:
		wruntime.EventsEmit(c.ctx, "commandCenter.exec", id)
		return nil
	}
}

func (c *CommandCenter) GotoLine(line, column int) error {
	wruntime.EventsEmit(c.ctx, "editor.gotoLine", map[string]int{
		"line":   line,
		"column": column,
	})
	return nil
}

func (c *CommandCenter) OpenFile(path string) error {
	wruntime.EventsEmit(c.ctx, "editor.openFile", path)
	return nil
}
