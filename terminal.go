package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	xpty "github.com/aymanbagabas/go-pty"
	"github.com/gorilla/websocket"
)

type StartOptions struct {
	Cwd   string            `json:"cwd"`
	Shell string            `json:"shell"`
	Args  []string          `json:"args"`
	Env   map[string]string `json:"env"`
	Cols  int               `json:"cols"`
	Rows  int               `json:"rows"`
}

type SessionInfo struct {
	ID        string `json:"id"`
	Pid       int    `json:"pid"`
	Shell     string `json:"shell"`
	Cwd       string `json:"cwd"`
	Cols      int    `json:"cols"`
	Rows      int    `json:"rows"`
	StartedAt int64  `json:"startedAt"`
	Running   bool   `json:"running"`
	ExitCode  int    `json:"exitCode"`
}

type ptySession struct {
	id        string
	pty       xpty.Pty
	cmd       *xpty.Cmd
	shell     string
	cwd       string
	cols      atomic.Int32
	rows      atomic.Int32
	startedAt time.Time
	running   atomic.Bool
	exitCode  atomic.Int32
	once      sync.Once

	// Quando o frontend abre o bridge WebSocket pra essa sessão, wsConn
	// aponta pra conexão. flush() serializa pra cá em vez de emitir via
	// runtime Wails (HTTP fetch), o que reduz a latência de E/S em ordens
	// de magnitude. Nil = caminho legacy via emit().
	wsConn    atomic.Pointer[websocket.Conn]
	wsWriteMu sync.Mutex
}

type Terminal struct {
	ctx      context.Context
	mu       sync.Mutex
	sessions map[string]*ptySession

	wsPort   int
	wsServer *http.Server
	upgrader websocket.Upgrader
}

func NewTerminal() *Terminal {
	return &Terminal{
		sessions: make(map[string]*ptySession),
		upgrader: websocket.Upgrader{
			CheckOrigin:     func(r *http.Request) bool { return true },
			ReadBufferSize:  16 * 1024,
			WriteBufferSize: 64 * 1024,
		},
	}
}

func (t *Terminal) startup(ctx context.Context) {
	t.ctx = ctx

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		logErrorf("Terminal WS: não foi possível abrir porta: %v", err)
		return
	}
	t.wsPort = ln.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/term/", t.handleWS)
	mux.HandleFunc("/bench/echo", t.handleBenchEchoWS)

	t.wsServer = &http.Server{Handler: mux}
	go func() {
		if err := t.wsServer.Serve(ln); err != nil && err != http.ErrServerClosed {
			logErrorf("Terminal WS server: %v", err)
		}
	}()

	logInfof("Terminal WS bridge rodando em 127.0.0.1:%d", t.wsPort)
}

// GetTerminalPort devolve a porta do bridge WebSocket pro frontend conectar.
func (t *Terminal) GetTerminalPort() int {
	return t.wsPort
}

// handleWS faz o upgrade pra WebSocket e amarra a conexão na sessão. Enquanto
// estiver conectado, o pump escreve direto no WS (binário) em vez de emitir
// eventos Wails. As mensagens recebidas viram input pro PTY.
func (t *Terminal) handleWS(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/term/")
	s, ok := t.get(id)
	if !ok {
		http.Error(w, "sessão não encontrada", http.StatusNotFound)
		return
	}

	ws, err := t.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	// só uma conexão WS ativa por sessão. Se já tem outra, fecha a antiga.
	if old := s.wsConn.Swap(ws); old != nil {
		_ = old.Close()
	}
	defer func() {
		s.wsConn.CompareAndSwap(ws, nil)
		_ = ws.Close()
	}()

	// WS → PTY (input do usuário). Bloqueia até a conexão fechar.
	for {
		_, msg, err := ws.ReadMessage()
		if err != nil {
			return
		}
		if !s.running.Load() {
			return
		}
		if _, err := s.pty.Write(msg); err != nil {
			return
		}
	}
}

func defaultShell() string {
	if runtime.GOOS == "windows" {
		if s := os.Getenv("COMSPEC"); s != "" {
			return s
		}
		return "powershell.exe"
	}
	if s := os.Getenv("SHELL"); s != "" {
		return s
	}
	return "/bin/bash"
}

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// StartPty mantida pra compatibilidade — chama StartPtyWith.
func (t *Terminal) StartPty(cwd string, cols, rows int) (string, error) {
	return t.StartPtyWith(StartOptions{Cwd: cwd, Cols: cols, Rows: rows})
}

func (t *Terminal) StartPtyWith(opts StartOptions) (string, error) {
	if opts.Cols <= 0 {
		opts.Cols = 80
	}
	if opts.Rows <= 0 {
		opts.Rows = 24
	}
	shell := opts.Shell
	if shell == "" {
		shell = t.GetDefaultShell()
	}

	pty, err := xpty.New()
	if err != nil {
		return "", err
	}
	if err := pty.Resize(opts.Cols, opts.Rows); err != nil {
		_ = pty.Close()
		return "", err
	}

	env := append([]string{}, os.Environ()...)
	env = append(env, "TERM=xterm-256color", "COLORTERM=truecolor", "TERM_PROGRAM=adila-ide")
	for k, v := range opts.Env {
		env = append(env, k+"="+v)
	}

	injectedArgs, injectedEnv, _ := injectIntegration(shell, opts.Args, env)
	cmd := pty.Command(shell, injectedArgs...)
	if opts.Cwd != "" {
		cmd.Dir = opts.Cwd
	}
	cmd.Env = injectedEnv

	if err := cmd.Start(); err != nil {
		_ = pty.Close()
		return "", err
	}

	id := newID()
	s := &ptySession{
		id:        id,
		pty:       pty,
		cmd:       cmd,
		shell:     shell,
		cwd:       opts.Cwd,
		startedAt: time.Now(),
	}
	s.cols.Store(int32(opts.Cols))
	s.rows.Store(int32(opts.Rows))
	s.running.Store(true)

	t.mu.Lock()
	t.sessions[id] = s
	t.mu.Unlock()

	go t.pump(s)
	go t.wait(s)

	return id, nil
}

// pump lê do pty e despacha o output. Quando o bridge WebSocket está
// conectado (caminho default), escreve cada Read() direto na WS — sem
// batching, sem timer, sem base64. O kernel já entrega a leitura quando
// tem dados, então cada chunk vira uma frame WS. Se a WS estiver caída,
// cai no fallback Wails event com base64.
//
// utf8SafeBoundary é mantido pra não cortar runes ao meio entre frames:
// o byte parcial fica retido como leftover até a próxima leitura.
func (t *Terminal) pump(s *ptySession) {
	dataEvent := "pty:data:" + s.id
	buf := make([]byte, 32*1024)
	leftover := make([]byte, 0, 4)

	send := func(data []byte) {
		if len(data) == 0 {
			return
		}
		if ws := s.wsConn.Load(); ws != nil {
			s.wsWriteMu.Lock()
			err := ws.WriteMessage(websocket.BinaryMessage, data)
			s.wsWriteMu.Unlock()
			if err == nil {
				return
			}
			s.wsConn.CompareAndSwap(ws, nil)
		}
		emit(dataEvent, base64.StdEncoding.EncodeToString(data))
	}

	for {
		n, err := s.pty.Read(buf)
		if n > 0 {
			var data []byte
			if len(leftover) > 0 {
				data = append(leftover, buf[:n]...)
				leftover = leftover[:0]
			} else {
				data = buf[:n]
			}
			safe := utf8SafeBoundary(data)
			if safe < len(data) {
				leftover = append(leftover[:0], data[safe:]...)
				data = data[:safe]
			}
			if len(data) > 0 {
				// cópia: WS pode segurar o slice depois do retorno
				out := make([]byte, len(data))
				copy(out, data)
				send(out)
			}
		}
		if err != nil {
			if len(leftover) > 0 {
				out := make([]byte, len(leftover))
				copy(out, leftover)
				send(out)
				leftover = leftover[:0]
			}
			if !errors.Is(err, io.EOF) {
				logDebugf("pty read end %s: %v", s.id, err)
			}
			return
		}
	}
}

// utf8SafeBoundary devolve o índice do último byte que finaliza um caractere UTF-8 válido.
func utf8SafeBoundary(b []byte) int {
	if len(b) == 0 {
		return 0
	}
	// rune mais longa em UTF-8 tem 4 bytes — basta olhar pra trás até 3 bytes
	for i := len(b); i > 0 && i > len(b)-4; i-- {
		r, size := utf8.DecodeLastRune(b[:i])
		if r == utf8.RuneError && size == 1 {
			continue
		}
		return i
	}
	return len(b)
}

func (t *Terminal) wait(s *ptySession) {
	err := s.cmd.Wait()
	code := 0
	if err != nil {
		code = -1
		var exitErr interface{ ExitCode() int }
		if errors.As(err, &exitErr) {
			code = exitErr.ExitCode()
		}
	}
	s.running.Store(false)
	s.exitCode.Store(int32(code))
	emit("pty:exit:"+s.id, code)
	t.removeAndClose(s.id)
}

func (t *Terminal) get(id string) (*ptySession, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	s, ok := t.sessions[id]
	return s, ok
}

// WritePty aceita base64 (preferido pro frontend) ou texto cru — detecta automaticamente.
// O frontend usa base64 pra evitar problemas de serialização JSON com bytes binários.
func (t *Terminal) WritePty(id string, data string) error {
	defer bench.Time("Terminal.WritePty")()
	s, ok := t.get(id)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	_, err := s.pty.Write([]byte(data))
	return err
}

func (t *Terminal) WritePtyB64(id string, data string) error {
	defer bench.Time("Terminal.WritePtyB64")()
	s, ok := t.get(id)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return err
	}
	_, err = s.pty.Write(raw)
	return err
}

func (t *Terminal) ResizePty(id string, cols, rows int) error {
	s, ok := t.get(id)
	if !ok {
		return errors.New("sessão não encontrada")
	}
	if cols <= 0 || rows <= 0 {
		return errors.New("dimensões inválidas")
	}
	s.cols.Store(int32(cols))
	s.rows.Store(int32(rows))
	return s.pty.Resize(cols, rows)
}

func (t *Terminal) ClosePty(id string) error {
	s, ok := t.get(id)
	if ok && s.cmd != nil && s.cmd.Process != nil {
		killProcessTree(s.cmd.Process.Pid)
	}
	t.removeAndClose(id)
	return nil
}

func (t *Terminal) ListPty() []SessionInfo {
	t.mu.Lock()
	defer t.mu.Unlock()
	out := make([]SessionInfo, 0, len(t.sessions))
	for _, s := range t.sessions {
		out = append(out, sessionInfo(s))
	}
	return out
}

func (t *Terminal) GetPty(id string) (SessionInfo, error) {
	s, ok := t.get(id)
	if !ok {
		return SessionInfo{}, errors.New("sessão não encontrada")
	}
	return sessionInfo(s), nil
}

func sessionInfo(s *ptySession) SessionInfo {
	pid := 0
	if s.cmd != nil && s.cmd.Process != nil {
		pid = s.cmd.Process.Pid
	}
	return SessionInfo{
		ID:        s.id,
		Pid:       pid,
		Shell:     s.shell,
		Cwd:       s.cwd,
		Cols:      int(s.cols.Load()),
		Rows:      int(s.rows.Load()),
		StartedAt: s.startedAt.UnixMilli(),
		Running:   s.running.Load(),
		ExitCode:  int(s.exitCode.Load()),
	}
}

func (t *Terminal) removeAndClose(id string) {
	t.mu.Lock()
	s, ok := t.sessions[id]
	if ok {
		delete(t.sessions, id)
	}
	t.mu.Unlock()
	if !ok {
		return
	}
	if ws := s.wsConn.Swap(nil); ws != nil {
		_ = ws.Close()
	}
	s.once.Do(func() {
		_ = s.pty.Close()
	})
}

func (t *Terminal) shutdown(_ context.Context) {
	if t.wsServer != nil {
		_ = t.wsServer.Close()
	}
	t.mu.Lock()
	ids := make([]string, 0, len(t.sessions))
	pids := make([]int, 0, len(t.sessions))
	for id, s := range t.sessions {
		ids = append(ids, id)
		if s.cmd != nil && s.cmd.Process != nil {
			pids = append(pids, s.cmd.Process.Pid)
		}
	}
	t.mu.Unlock()
	for _, pid := range pids {
		killProcessTree(pid)
	}
	for _, id := range ids {
		t.removeAndClose(id)
	}
}
