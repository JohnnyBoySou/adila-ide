package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"runtime"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
	"unicode/utf8"

	xpty "github.com/aymanbagabas/go-pty"
	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// flushInterval and flushBytes control output batching.
// Curtos o suficiente pra não atrasar a digitação,
// grandes o suficiente pra coalescer floods de output.
const (
	flushInterval = 12 * time.Millisecond
	flushBytes    = 64 * 1024
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
}

type Terminal struct {
	ctx      context.Context
	mu       sync.Mutex
	sessions map[string]*ptySession
}

func NewTerminal() *Terminal {
	return &Terminal{sessions: make(map[string]*ptySession)}
}

func (t *Terminal) startup(ctx context.Context) {
	t.ctx = ctx
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

// pump lê do pty e emite chunks UTF-8-safe e batched.
func (t *Terminal) pump(s *ptySession) {
	dataEvent := "pty:data:" + s.id
	read := make([]byte, 32*1024)
	pending := make([]byte, 0, flushBytes)
	timer := time.NewTimer(flushInterval)
	timer.Stop()
	timerActive := false

	flush := func() {
		if len(pending) == 0 {
			return
		}
		// Bench mede latência por flush (chunk → frontend). pump() em si é
		// goroutine de vida longa, então benchear a função inteira não diz nada.
		defer bench.Time("Terminal.pumpFlush")()
		// só envia até o último boundary UTF-8 válido,
		// guardando bytes parciais pra próxima rodada
		safe := utf8SafeBoundary(pending)
		if safe == 0 {
			return
		}
		chunk := make([]byte, safe)
		copy(chunk, pending[:safe])
		pending = append(pending[:0], pending[safe:]...)
		wruntime.EventsEmit(t.ctx, dataEvent, base64.StdEncoding.EncodeToString(chunk))
	}

	stopTimer := func() {
		if timerActive {
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			timerActive = false
		}
	}

	for {
		readDone := make(chan struct{})
		var n int
		var err error
		go func() {
			n, err = s.pty.Read(read)
			close(readDone)
		}()

		select {
		case <-readDone:
		case <-timer.C:
			timerActive = false
			flush()
			<-readDone
		}

		if n > 0 {
			pending = append(pending, read[:n]...)
			if len(pending) >= flushBytes {
				stopTimer()
				flush()
			} else if !timerActive {
				timer.Reset(flushInterval)
				timerActive = true
			}
		}
		if err != nil {
			stopTimer()
			// flush força incluindo bytes "parciais" no fim
			if len(pending) > 0 {
				wruntime.EventsEmit(t.ctx, dataEvent, base64.StdEncoding.EncodeToString(pending))
				pending = pending[:0]
			}
			if !errors.Is(err, io.EOF) {
				wruntime.LogDebugf(t.ctx, "pty read end %s: %v", s.id, err)
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
	wruntime.EventsEmit(t.ctx, "pty:exit:"+s.id, code)
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
	s.once.Do(func() {
		_ = s.pty.Close()
	})
}

func (t *Terminal) shutdown(_ context.Context) {
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

// killProcessTree mata o processo e seu grupo. go-pty cria a sessão
// já em um novo session/process group, então kill(-pid) atinge filhos.
func killProcessTree(pid int) {
	if pid <= 0 {
		return
	}
	if runtime.GOOS == "windows" {
		_ = syscall.Kill(pid, syscall.SIGKILL)
		return
	}
	_ = syscall.Kill(-pid, syscall.SIGTERM)
	time.Sleep(150 * time.Millisecond)
	_ = syscall.Kill(-pid, syscall.SIGKILL)
}
