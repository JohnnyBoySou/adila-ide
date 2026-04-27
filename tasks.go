package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

type TaskKind string

const (
	TaskNpm   TaskKind = "npm"
	TaskGo    TaskKind = "go"
	TaskCargo TaskKind = "cargo"
)

type TaskDef struct {
	ID      string   `json:"id"`
	Kind    TaskKind `json:"kind"`
	Label   string   `json:"label"`
	Detail  string   `json:"detail"`
	Command string   `json:"command"`
	Cwd     string   `json:"cwd"`
	Source  string   `json:"source"`
}

type Tasks struct {
	ctx     context.Context
	mu      sync.Mutex
	workdir string
	term    *Terminal
}

func NewTasks(term *Terminal) *Tasks {
	return &Tasks{term: term}
}

func (t *Tasks) startup(ctx context.Context) {
	t.ctx = ctx
}

func (t *Tasks) SetWorkdir(path string) {
	t.mu.Lock()
	changed := t.workdir != path
	t.workdir = path
	t.mu.Unlock()
	if changed && t.ctx != nil {
		emit("tasks.changed")
	}
}

// List enumera tasks detectadas no workdir atual. Sem workdir, retorna lista vazia.
func (t *Tasks) List() ([]TaskDef, error) {
	defer bench.Time("Tasks.List")()
	t.mu.Lock()
	root := t.workdir
	t.mu.Unlock()
	if root == "" {
		return []TaskDef{}, nil
	}
	out := make([]TaskDef, 0, 16)
	out = append(out, scanNpmTasks(root)...)
	out = append(out, scanGoTasks(root)...)
	out = append(out, scanCargoTasks(root)...)
	return out, nil
}

// Run inicia uma task em uma nova sessão PTY e retorna o ID da sessão. O
// frontend pode anexar essa sessão ao TerminalPanel pra mostrar o output.
func (t *Tasks) Run(taskID string) (string, error) {
	defer bench.Time("Tasks.Run")()
	if t.term == nil {
		return "", errors.New("terminal indisponível")
	}
	list, err := t.List()
	if err != nil {
		return "", err
	}
	var def *TaskDef
	for i := range list {
		if list[i].ID == taskID {
			def = &list[i]
			break
		}
	}
	if def == nil {
		return "", fmt.Errorf("task não encontrada: %s", taskID)
	}
	shell, args := taskShellInvocation(def.Command)
	return t.term.StartPtyWith(StartOptions{
		Cwd:   def.Cwd,
		Shell: shell,
		Args:  args,
		Cols:  120,
		Rows:  30,
	})
}

func scanNpmTasks(root string) []TaskDef {
	raw, err := os.ReadFile(filepath.Join(root, "package.json"))
	if err != nil {
		return nil
	}
	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(raw, &pkg); err != nil || len(pkg.Scripts) == 0 {
		return nil
	}
	runner := detectNodeRunner(root)
	out := make([]TaskDef, 0, len(pkg.Scripts))
	for name, body := range pkg.Scripts {
		out = append(out, TaskDef{
			ID:      "npm:" + name,
			Kind:    TaskNpm,
			Label:   name,
			Detail:  body,
			Command: runner + " run " + shellEscapeArg(name),
			Cwd:     root,
			Source:  "package.json",
		})
	}
	return out
}

func detectNodeRunner(root string) string {
	checks := []struct {
		file   string
		runner string
	}{
		{"bun.lock", "bun"},
		{"bun.lockb", "bun"},
		{"pnpm-lock.yaml", "pnpm"},
		{"yarn.lock", "yarn"},
	}
	for _, c := range checks {
		if _, err := os.Stat(filepath.Join(root, c.file)); err == nil {
			return c.runner
		}
	}
	return "npm"
}

func scanGoTasks(root string) []TaskDef {
	if _, err := os.Stat(filepath.Join(root, "go.mod")); err != nil {
		return nil
	}
	const src = "go.mod"
	return []TaskDef{
		{ID: "go:build", Kind: TaskGo, Label: "go build", Detail: "compila todos os pacotes", Command: "go build ./...", Cwd: root, Source: src},
		{ID: "go:test", Kind: TaskGo, Label: "go test", Detail: "roda os testes", Command: "go test ./...", Cwd: root, Source: src},
		{ID: "go:run", Kind: TaskGo, Label: "go run", Detail: "executa o pacote main", Command: "go run .", Cwd: root, Source: src},
		{ID: "go:vet", Kind: TaskGo, Label: "go vet", Detail: "análise estática", Command: "go vet ./...", Cwd: root, Source: src},
		{ID: "go:tidy", Kind: TaskGo, Label: "go mod tidy", Detail: "ajusta dependências", Command: "go mod tidy", Cwd: root, Source: src},
	}
}

func scanCargoTasks(root string) []TaskDef {
	if _, err := os.Stat(filepath.Join(root, "Cargo.toml")); err != nil {
		return nil
	}
	const src = "Cargo.toml"
	return []TaskDef{
		{ID: "cargo:build", Kind: TaskCargo, Label: "cargo build", Detail: "compila o pacote", Command: "cargo build", Cwd: root, Source: src},
		{ID: "cargo:run", Kind: TaskCargo, Label: "cargo run", Detail: "executa o binário", Command: "cargo run", Cwd: root, Source: src},
		{ID: "cargo:test", Kind: TaskCargo, Label: "cargo test", Detail: "roda os testes", Command: "cargo test", Cwd: root, Source: src},
		{ID: "cargo:check", Kind: TaskCargo, Label: "cargo check", Detail: "verifica sem compilar binário", Command: "cargo check", Cwd: root, Source: src},
		{ID: "cargo:clippy", Kind: TaskCargo, Label: "cargo clippy", Detail: "lints adicionais", Command: "cargo clippy", Cwd: root, Source: src},
	}
}

func shellEscapeArg(s string) string {
	if s == "" {
		return "''"
	}
	if strings.ContainsAny(s, " \t\"'\\$`!(){}[]|;<>?*&#~") {
		return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
	}
	return s
}

// taskShellInvocation devolve shell + args para executar `cmd` em modo
// não-interativo. injectIntegration acrescenta --rcfile/-C, mas ambos são
// inofensivos quando combinados com -c em bash/zsh/fish.
func taskShellInvocation(cmd string) (string, []string) {
	if runtime.GOOS == "windows" {
		shell := os.Getenv("COMSPEC")
		if shell == "" {
			shell = "cmd.exe"
		}
		return shell, []string{"/C", cmd}
	}
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	return shell, []string{"-c", cmd}
}
