package main

import (
	"context"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/gorilla/websocket"
)

// stripFileScheme converte um URI "file:///abs/path" no caminho local "/abs/path".
// Retorna "" se o resultado não for um diretório existente — o LSP gopls falha
// com ENOENT (mensagem confusa "fork/exec gopls: no such file or directory") se
// passarmos cmd.Dir inválido, então é melhor não setar nada.
func stripFileScheme(raw string) string {
	if raw == "" {
		return ""
	}
	path := raw
	if strings.HasPrefix(path, "file://") {
		if u, err := url.Parse(path); err == nil && u.Path != "" {
			path = u.Path
		} else {
			path = strings.TrimPrefix(path, "file://")
		}
	}
	if info, err := os.Stat(path); err != nil || !info.IsDir() {
		return ""
	}
	return path
}

// lspServers mapeia linguagem → candidatos de binário (em ordem de preferência).
var lspServers = map[string][]string{
	"go":         {"gopls"},
	"typescript": {"typescript-language-server", "bunx typescript-language-server", "npx typescript-language-server", "npx --yes typescript-language-server"},
	"javascript": {"typescript-language-server", "bunx typescript-language-server", "npx typescript-language-server", "npx --yes typescript-language-server"},
	"rust":       {"rust-analyzer"},
	"python":     {"pyright-langserver", "pylsp", "python-lsp-server"},
	"css":        {"css-languageserver", "vscode-css-languageserver"},
	"html":       {"html-languageserver", "vscode-html-languageserver"},
	"json":       {"json-languageserver", "vscode-json-languageserver"},
	"yaml":       {"yaml-language-server"},
}

// lspArgs são args adicionais além do binário (após o binário).
var lspArgs = map[string][]string{
	"typescript": {"--stdio"},
	"javascript": {"--stdio"},
	"python":     {"--tcp"},
	"css":        {"--stdio"},
	"html":       {"--stdio"},
	"json":       {"--stdio"},
	"yaml":       {"--stdio"},
}

type LSP struct {
	ctx      context.Context
	port     int
	server   *http.Server
	upgrader websocket.Upgrader
	started  atomic.Bool
	mu       sync.Mutex
	// lang/root → binário disponível (cache). Root importa porque TS pode vir
	// de node_modules/.bin do workspace, sem depender do PATH global.
	available map[string]string
}

func NewLSP() *LSP {
	return &LSP{
		available: make(map[string]string),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (l *LSP) startup(ctx context.Context) {
	l.ctx = ctx

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		logErrorf("LSP: não foi possível abrir porta: %v", err)
		return
	}
	l.port = ln.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/lsp/", l.handleWS)

	l.server = &http.Server{Handler: mux}
	l.started.Store(true)

	go func() {
		if err := l.server.Serve(ln); err != nil && err != http.ErrServerClosed {
			logErrorf("LSP server: %v", err)
		}
	}()

	logInfof("LSP proxy rodando em 127.0.0.1:%d", l.port)
}

func (l *LSP) shutdown(_ context.Context) {
	if l.server != nil {
		_ = l.server.Close()
	}
}

// GetLSPPort devolve a porta do proxy WebSocket LSP.
func (l *LSP) GetLSPPort() int {
	return l.port
}

// ListAvailableLSP devolve quais linguagens têm servidor instalado.
func (l *LSP) ListAvailableLSP() map[string]string {
	l.mu.Lock()
	defer l.mu.Unlock()

	result := make(map[string]string)
	for lang, candidates := range lspServers {
		if bin := l.resolveBin(lang, candidates, ""); bin != "" {
			result[lang] = bin
		}
	}
	return result
}

// resolveBin encontra o primeiro servidor disponível. Ordem:
//  1. gerenciado pelo Adila (~/.config/adila/lsp-servers)
//  2. embutido/vendorizado no app ou node_modules/.bin do workspace
//  3. PATH do sistema (inclui fallback npx/bunx)
//
// não usa mutex — deve ser chamado com l.mu held.
func (l *LSP) resolveBin(lang string, candidates []string, workspaceRoot string) string {
	cacheKey := lang + "\x00" + workspaceRoot
	if cached, ok := l.available[cacheKey]; ok {
		return cached
	}
	for _, candidate := range candidates {
		parts := strings.Fields(candidate)
		if len(parts) == 0 {
			continue
		}
		// Binário gerenciado (instalado via UI em ~/.config/adila/lsp-servers)
		// tem precedência sobre o PATH — garante versão consistente entre máquinas.
		if managed := managedBinPath(parts[0]); managed != "" {
			full := managed
			if len(parts) > 1 {
				full = strings.Join(append([]string{managed}, parts[1:]...), " ")
			}
			l.available[cacheKey] = full
			return full
		}
		if bundled := bundledBinPath(parts[0], workspaceRoot); bundled != "" {
			full := bundled
			if len(parts) > 1 {
				full = strings.Join(append([]string{bundled}, parts[1:]...), " ")
			}
			l.available[cacheKey] = full
			return full
		}
		if bin, err := exec.LookPath(parts[0]); err == nil {
			full := bin
			if len(parts) > 1 {
				full = strings.Join(append([]string{bin}, parts[1:]...), " ")
			}
			l.available[cacheKey] = full
			return full
		}
	}
	return ""
}

func bundledBinPath(binaryName, workspaceRoot string) string {
	names := []string{binaryName}
	if runtime.GOOS == "windows" {
		names = []string{binaryName + ".cmd", binaryName + ".exe", binaryName}
	}
	roots := []string{}
	if workspaceRoot != "" {
		roots = append(roots, workspaceRoot)
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		roots = append(roots, exeDir, filepath.Dir(exeDir))
	}
	if cwd, err := os.Getwd(); err == nil {
		roots = append(roots, cwd, filepath.Join(cwd, "frontend"))
	}
	for _, root := range roots {
		for _, name := range names {
			for _, candidate := range []string{
				filepath.Join(root, "node_modules", ".bin", name),
				filepath.Join(root, "lsp-servers", name),
				filepath.Join(root, "resources", "lsp-servers", name),
			} {
				if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
					return candidate
				}
			}
		}
	}
	return ""
}

func (l *LSP) handleWS(w http.ResponseWriter, r *http.Request) {
	// rota: /lsp/{lang}
	lang := strings.TrimPrefix(r.URL.Path, "/lsp/")
	lang = strings.ToLower(strings.TrimSpace(lang))
	rootPath := r.URL.Query().Get("root")
	rootDir := stripFileScheme(rootPath)

	candidates, ok := lspServers[lang]
	if !ok {
		http.Error(w, "linguagem não suportada: "+lang, http.StatusBadRequest)
		return
	}

	l.mu.Lock()
	bin := l.resolveBin(lang, candidates, rootDir)
	l.mu.Unlock()

	if bin == "" {
		http.Error(w, "servidor LSP não encontrado para: "+lang, http.StatusServiceUnavailable)
		return
	}

	ws, err := l.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	args := lspArgs[lang]
	binParts := strings.Fields(bin)
	cmdBin := binParts[0]
	cmdArgs := append(binParts[1:], args...)

	cmd := exec.CommandContext(r.Context(), cmdBin, cmdArgs...)
	if rootDir != "" {
		cmd.Dir = rootDir
	}
	if runtime.GOOS != "windows" {
		// evita que o LSP receba sinais do terminal
		setLSPSysProcAttr(cmd)
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		ws.WriteMessage(websocket.CloseMessage, []byte("falha ao criar stdin"))
		return
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		ws.WriteMessage(websocket.CloseMessage, []byte("falha ao criar stdout"))
		return
	}
	// stderr vai pra log mas não pro cliente
	cmd.Stderr = &logWriter{ctx: l.ctx, prefix: lang + " lsp"}

	if err := cmd.Start(); err != nil {
		ws.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseInternalServerErr, err.Error()))
		return
	}

	done := make(chan struct{})

	// Bench: nome inclui a linguagem para separar latência por servidor (gopls
	// vs rust-analyzer têm perfis muito diferentes).
	stdoutOp := "LSP." + lang + ".stdoutToWS"
	stdinOp := "LSP." + lang + ".wsToStdin"

	// LSP stdout → WebSocket
	go func() {
		defer close(done)
		buf := make([]byte, 64*1024)
		for {
			n, err := stdout.Read(buf)
			if n > 0 {
				stop := bench.Time(stdoutOp)
				ws.WriteMessage(websocket.BinaryMessage, buf[:n])
				stop()
			}
			if err != nil {
				return
			}
		}
	}()

	// WebSocket → LSP stdin
	go func() {
		for {
			_, msg, err := ws.ReadMessage()
			if err != nil {
				return
			}
			stop := bench.Time(stdinOp)
			_, werr := stdin.Write(msg)
			stop()
			if werr != nil {
				return
			}
		}
	}()

	<-done
	_ = cmd.Process.Kill()
	_ = cmd.Wait()
}

type logWriter struct {
	ctx    context.Context
	prefix string
	buf    []byte
}

func (lw *logWriter) Write(p []byte) (int, error) {
	lw.buf = append(lw.buf, p...)
	for {
		idx := strings.IndexByte(string(lw.buf), '\n')
		if idx < 0 {
			break
		}
		line := string(lw.buf[:idx])
		lw.buf = lw.buf[idx+1:]
		if strings.TrimSpace(line) != "" {
			logDebugf("[%s] %s", lw.prefix, line)
		}
	}
	return len(p), nil
}
