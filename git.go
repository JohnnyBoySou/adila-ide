package main

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type GitChangedFile struct {
	Path     string `json:"path"`
	PrevPath string `json:"prevPath,omitempty"`
	Status   string `json:"status"`
	Staged   bool   `json:"staged"`
}

type GitBranch struct {
	Name    string `json:"name"`
	Current bool   `json:"current"`
}

type GitCommit struct {
	Hash      string `json:"hash"`
	ShortHash string `json:"shortHash"`
	Message   string `json:"message"`
	Author    string `json:"author"`
	Date      string `json:"date"`
}

type GitStash struct {
	Index   int    `json:"index"`
	Message string `json:"message"`
	Date    string `json:"date"`
}

type GitRemote struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type GitGraphNode struct {
	Hash    string   `json:"hash"`
	Short   string   `json:"short"`
	Parents []string `json:"parents"`
	Refs    []string `json:"refs"`
	Subject string   `json:"subject"`
	Author  string   `json:"author"`
	Date    string   `json:"date"`
	Ts      int64    `json:"ts"`
}

type Git struct {
	ctx     context.Context
	workdir string
}

func NewGit() *Git {
	return &Git{}
}

func (g *Git) startup(ctx context.Context) {
	g.ctx = ctx
}

func (g *Git) SetWorkdir(path string) {
	g.workdir = path
	g.emitChanged()
}

func (g *Git) git(args ...string) (string, error) {
	cmd := exec.CommandContext(g.ctx, "git", args...)
	cmd.Dir = g.workdir
	var out bytes.Buffer
	var errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(errBuf.String())
		if msg == "" {
			msg = err.Error()
		}
		return "", &gitError{msg}
	}
	return out.String(), nil
}

type gitError struct{ msg string }

func (e *gitError) Error() string { return e.msg }

// Status devolve a lista de arquivos modificados (staged + unstaged).
func (g *Git) Status() ([]GitChangedFile, error) {
	if g.workdir == "" {
		return []GitChangedFile{}, nil
	}
	out, err := g.git("status", "--porcelain=v1", "-z")
	if err != nil {
		return nil, err
	}
	return parseStatus(out), nil
}

func parseStatus(raw string) []GitChangedFile {
	var files []GitChangedFile
	// --porcelain=v1 -z: entradas separadas por NUL, cada entrada tem 2 chars de status + espaço + path
	// renomes: XY path NUL origPath NUL
	entries := strings.Split(raw, "\x00")
	i := 0
	for i < len(entries) {
		e := entries[i]
		if len(e) < 4 {
			i++
			continue
		}
		x := rune(e[0]) // staged
		y := rune(e[1]) // unstaged
		path := e[3:]

		if x != ' ' && x != '?' {
			f := GitChangedFile{Path: path, Staged: true, Status: xyToStatus(x)}
			if x == 'R' || x == 'C' {
				// próxima entrada é o path original
				i++
				if i < len(entries) {
					f.PrevPath = entries[i]
				}
			}
			files = append(files, f)
		}
		if y != ' ' && y != '?' && !(x == '?' && y == '?') {
			files = append(files, GitChangedFile{Path: path, Staged: false, Status: xyToStatus(y)})
		}
		// untracked: ambos '?'
		if x == '?' && y == '?' {
			files = append(files, GitChangedFile{Path: path, Staged: false, Status: "untracked"})
		}
		i++
	}
	return files
}

func xyToStatus(c rune) string {
	switch c {
	case 'M':
		return "modified"
	case 'A':
		return "added"
	case 'D':
		return "deleted"
	case 'R', 'C':
		return "renamed"
	case 'U':
		return "conflicted"
	default:
		return "modified"
	}
}

// Diff devolve o patch unificado de um arquivo.
func (g *Git) Diff(path string, staged bool) (string, error) {
	var args []string
	if staged {
		args = []string{"diff", "--cached", "--", path}
	} else {
		args = []string{"diff", "--", path}
	}
	out, err := g.git(args...)
	if err != nil {
		return "", err
	}
	return out, nil
}

// Stage adiciona um arquivo ao index.
func (g *Git) Stage(path string) error {
	_, err := g.git("add", "--", path)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// Unstage remove um arquivo do index.
func (g *Git) Unstage(path string) error {
	_, err := g.git("reset", "HEAD", "--", path)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// StageAll adiciona todos os arquivos ao index.
func (g *Git) StageAll() error {
	_, err := g.git("add", "-A")
	if err == nil {
		g.emitChanged()
	}
	return err
}

// Discard descarta mudanças não staged de um arquivo.
func (g *Git) Discard(path string) error {
	// para untracked, remove o arquivo; para tracked, checkout
	out, _ := g.git("ls-files", "--others", "--exclude-standard", "--", path)
	if strings.TrimSpace(out) != "" {
		_, err := g.git("clean", "-f", "--", path)
		if err == nil {
			g.emitChanged()
		}
		return err
	}
	_, err := g.git("checkout", "--", path)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// Commit cria um commit com os arquivos em stage.
func (g *Git) Commit(message string) error {
	_, err := g.git("commit", "-m", message)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// Push faz push para o remote, com fallback --set-upstream origin/<branch> se não houver upstream.
func (g *Git) Push() error {
	_, err := g.git("push")
	if err == nil {
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "no upstream branch") || strings.Contains(msg, "set-upstream") || strings.Contains(msg, "has no upstream") {
		branch, berr := g.GetBranch()
		if berr != nil || branch == "" {
			return err
		}
		_, err2 := g.git("push", "--set-upstream", "origin", branch)
		if err2 == nil {
			g.emitChanged()
			return nil
		}
		return err2
	}
	return err
}

// IsRepo verifica se o workdir é um repositório git.
func (g *Git) IsRepo() bool {
	if g.workdir == "" {
		return false
	}
	_, err := g.git("rev-parse", "--git-dir")
	return err == nil
}

// Init inicializa um novo repositório git no workdir.
func (g *Git) Init() error {
	if g.workdir == "" {
		return &gitError{"nenhuma pasta aberta"}
	}
	_, err := g.git("init")
	if err == nil {
		g.emitChanged()
	}
	return err
}

// GetBranch retorna o nome da branch atual.
func (g *Git) GetBranch() (string, error) {
	if g.workdir == "" {
		return "", nil
	}
	out, err := g.git("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", nil
	}
	return strings.TrimSpace(out), nil
}

// ListBranches retorna todas as branches locais.
func (g *Git) ListBranches() ([]GitBranch, error) {
	out, err := g.git("branch", "--format=%(refname:short)\t%(HEAD)")
	if err != nil {
		return nil, err
	}
	var branches []GitBranch
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\t", 2)
		name := parts[0]
		current := len(parts) > 1 && parts[1] == "*"
		branches = append(branches, GitBranch{Name: name, Current: current})
	}
	return branches, nil
}

// Pull faz git pull na branch atual, com fallback para origin/<branch> se não houver upstream.
func (g *Git) Pull() error {
	_, err := g.git("pull")
	if err == nil {
		g.emitChanged()
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "no tracking information") || strings.Contains(msg, "Please specify which branch") {
		branch, berr := g.GetBranch()
		if berr != nil || branch == "" {
			return err
		}
		_, err2 := g.git("pull", "origin", branch)
		if err2 == nil {
			g.emitChanged()
			return nil
		}
		return err2
	}
	return err
}

// Fetch faz git fetch --prune.
func (g *Git) Fetch() error {
	_, err := g.git("fetch", "--prune")
	return err
}

// GetLog retorna os últimos n commits.
func (g *Git) GetLog(limit int) ([]GitCommit, error) {
	if g.workdir == "" {
		return []GitCommit{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	out, err := g.git("log", fmt.Sprintf("-n%d", limit), "--format=%H\x1f%h\x1f%s\x1f%an\x1f%ar")
	if err != nil {
		return nil, err
	}
	var commits []GitCommit
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 5)
		if len(parts) < 5 {
			continue
		}
		commits = append(commits, GitCommit{
			Hash:      parts[0],
			ShortHash: parts[1],
			Message:   parts[2],
			Author:    parts[3],
			Date:      parts[4],
		})
	}
	return commits, nil
}

// CreateBranch cria e muda para uma nova branch.
func (g *Git) CreateBranch(name string) error {
	_, err := g.git("checkout", "-b", name)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// CheckoutBranch muda para uma branch existente.
func (g *Git) CheckoutBranch(name string) error {
	_, err := g.git("checkout", name)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// DeleteBranch deleta uma branch local.
func (g *Git) DeleteBranch(name string, force bool) error {
	flag := "-d"
	if force {
		flag = "-D"
	}
	_, err := g.git("branch", flag, name)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// StashSave salva as mudanças em um stash.
func (g *Git) StashSave(message string) error {
	args := []string{"stash", "push"}
	if message != "" {
		args = append(args, "-m", message)
	}
	_, err := g.git(args...)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// StashList lista os stashes disponíveis.
func (g *Git) StashList() ([]GitStash, error) {
	if g.workdir == "" {
		return []GitStash{}, nil
	}
	out, err := g.git("stash", "list", "--format=%gd\x1f%s\x1f%ar")
	if err != nil {
		return nil, err
	}
	var stashes []GitStash
	i := 0
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 3)
		msg, date := "", ""
		if len(parts) > 1 {
			msg = parts[1]
		}
		if len(parts) > 2 {
			date = parts[2]
		}
		stashes = append(stashes, GitStash{Index: i, Message: msg, Date: date})
		i++
	}
	return stashes, nil
}

// StashPop aplica e remove um stash.
func (g *Git) StashPop(index int) error {
	_, err := g.git("stash", "pop", fmt.Sprintf("stash@{%d}", index))
	if err == nil {
		g.emitChanged()
	}
	return err
}

// StashDrop remove um stash sem aplicar.
func (g *Git) StashDrop(index int) error {
	_, err := g.git("stash", "drop", fmt.Sprintf("stash@{%d}", index))
	if err == nil {
		g.emitChanged()
	}
	return err
}

// UndoLastCommit desfaz o último commit mantendo as mudanças em stage.
func (g *Git) UndoLastCommit() error {
	_, err := g.git("reset", "HEAD~1", "--soft")
	if err == nil {
		g.emitChanged()
	}
	return err
}

// AmendLastCommit modifica a mensagem do último commit.
func (g *Git) AmendLastCommit(message string) error {
	args := []string{"commit", "--amend"}
	if message != "" {
		args = append(args, "-m", message)
	} else {
		args = append(args, "--no-edit")
	}
	_, err := g.git(args...)
	if err == nil {
		g.emitChanged()
	}
	return err
}

// ListRemotes lista os remotes configurados.
func (g *Git) ListRemotes() ([]GitRemote, error) {
	if g.workdir == "" {
		return []GitRemote{}, nil
	}
	out, err := g.git("remote", "-v")
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	var remotes []GitRemote
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}
		name := parts[0]
		if !seen[name] {
			seen[name] = true
			remotes = append(remotes, GitRemote{Name: name, URL: parts[1]})
		}
	}
	return remotes, nil
}

// GetGraph retorna os nós do grafo de commits para visualização.
func (g *Git) GetGraph(limit int) ([]GitGraphNode, error) {
	if g.workdir == "" {
		return []GitGraphNode{}, nil
	}
	if limit <= 0 {
		limit = 150
	}
	out, err := g.git("log",
		fmt.Sprintf("-n%d", limit),
		"--format=%H\x1f%h\x1f%P\x1f%D\x1f%s\x1f%an\x1f%ar\x1f%ct",
		"--all", "--topo-order")
	if err != nil {
		return nil, err
	}
	var nodes []GitGraphNode
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, "\x1f", 8)
		if len(parts) < 8 {
			continue
		}
		var parents []string
		if p := strings.TrimSpace(parts[2]); p != "" {
			parents = strings.Fields(p)
		}
		var refs []string
		for _, ref := range strings.Split(parts[3], ",") {
			ref = strings.TrimSpace(ref)
			if ref == "" {
				continue
			}
			if strings.HasPrefix(ref, "HEAD -> ") {
				refs = append(refs, strings.TrimPrefix(ref, "HEAD -> "))
			} else if ref != "HEAD" {
				refs = append(refs, ref)
			}
		}
		var ts int64
		fmt.Sscanf(parts[7], "%d", &ts)
		nodes = append(nodes, GitGraphNode{
			Hash:    parts[0],
			Short:   parts[1],
			Parents: parents,
			Refs:    refs,
			Subject: parts[4],
			Author:  parts[5],
			Date:    parts[6],
			Ts:      ts,
		})
	}
	return nodes, nil
}

// AddRemote adiciona um remote; se já existir, faz set-url com o novo valor.
func (g *Git) AddRemote(name, url string) error {
	if g.workdir == "" {
		return &gitError{"workdir não definido"}
	}
	if _, err := g.git("remote", "add", name, url); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			_, err2 := g.git("remote", "set-url", name, url)
			return err2
		}
		return err
	}
	return nil
}

// HasCommits retorna true se o repositório já tem ao menos um commit (HEAD válido).
func (g *Git) HasCommits() (bool, error) {
	if g.workdir == "" {
		return false, nil
	}
	if _, err := g.git("rev-parse", "--verify", "HEAD"); err != nil {
		return false, nil
	}
	return true, nil
}

// firstCommitIfEmpty cria um commit inicial vazio para que push possa enviar
// uma branch para o remote (necessário antes de publicar um repo recém-criado).
func (g *Git) firstCommitIfEmpty() error {
	if g.workdir == "" {
		return &gitError{"workdir não definido"}
	}
	if _, err := g.git("commit", "--allow-empty", "-m", "Initial commit"); err != nil {
		return err
	}
	g.emitChanged()
	return nil
}

func (g *Git) emitChanged() {
	if g.ctx != nil {
		wruntime.EventsEmit(g.ctx, "git.changed")
	}
}
