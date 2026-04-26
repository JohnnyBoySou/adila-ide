package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// BenchHistoryFile representa um arquivo de relatório de benchmark salvo no
// disco (gerado por scripts/benchmark.sh ou scripts/benchmark-frontend.sh).
type BenchHistoryFile struct {
	Name     string `json:"name"`     // nome do arquivo (sem path)
	Kind     string `json:"kind"`     // "go", "frontend", "baseline" ou "other"
	Format   string `json:"format"`   // "md", "txt", "json"
	Size     int64  `json:"size"`     // bytes
	ModUnix  int64  `json:"modUnix"`  // mtime em unix seconds
	Path     string `json:"path"`     // path absoluto
}

// benchmarksDir tenta localizar a pasta "benchmarks" do projeto. Em dev (wails
// dev) o cwd é a raiz; em build standalone o exe vive em build/bin/, então
// também procuramos relativo ao executável (../../benchmarks).
func benchmarksDir() (string, error) {
	if cwd, err := os.Getwd(); err == nil {
		candidate := filepath.Join(cwd, "benchmarks")
		if st, err := os.Stat(candidate); err == nil && st.IsDir() {
			return candidate, nil
		}
	}
	exe, err := os.Executable()
	if err == nil {
		base := filepath.Dir(exe)
		for _, rel := range []string{"benchmarks", "../benchmarks", "../../benchmarks"} {
			candidate := filepath.Clean(filepath.Join(base, rel))
			if st, err := os.Stat(candidate); err == nil && st.IsDir() {
				return candidate, nil
			}
		}
	}
	return "", errors.New("pasta benchmarks/ não encontrada")
}

func classifyBenchFile(name string) (kind, format string) {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".md"):
		format = "md"
	case strings.HasSuffix(lower, ".json"):
		format = "json"
	case strings.HasSuffix(lower, ".txt"):
		format = "txt"
	default:
		format = "other"
	}
	switch {
	case strings.Contains(lower, "frontend"):
		kind = "frontend"
	case strings.Contains(lower, "baseline"):
		kind = "baseline"
	case strings.HasPrefix(lower, "benchmark_"):
		kind = "go"
	default:
		kind = "other"
	}
	return
}

// ListHistory devolve a lista dos relatórios de benchmark, ordenados por mtime
// desc (mais recente primeiro).
func (b *Bench) ListHistory() ([]BenchHistoryFile, error) {
	dir, err := benchmarksDir()
	if err != nil {
		return []BenchHistoryFile{}, nil
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]BenchHistoryFile, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		kind, format := classifyBenchFile(name)
		out = append(out, BenchHistoryFile{
			Name:    name,
			Kind:    kind,
			Format:  format,
			Size:    info.Size(),
			ModUnix: info.ModTime().Unix(),
			Path:    filepath.Join(dir, name),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ModUnix > out[j].ModUnix })
	return out, nil
}

// ReadHistory devolve o conteúdo textual de um relatório. Limita o tamanho
// para evitar surpresas (1 MiB já é bem mais do que qualquer relatório legítimo).
func (b *Bench) ReadHistory(name string) (string, error) {
	dir, err := benchmarksDir()
	if err != nil {
		return "", err
	}
	if name == "" || strings.ContainsAny(name, "/\\") || strings.Contains(name, "..") {
		return "", fmt.Errorf("nome inválido: %q", name)
	}
	full := filepath.Join(dir, name)
	if rel, err := filepath.Rel(dir, full); err != nil || strings.HasPrefix(rel, "..") {
		return "", errors.New("path fora do diretório benchmarks")
	}
	f, err := os.Open(full)
	if err != nil {
		return "", err
	}
	defer f.Close()
	const maxBytes = 1 << 20 // 1 MiB
	body, err := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if err != nil {
		return "", err
	}
	if len(body) > maxBytes {
		body = append(body[:maxBytes], []byte("\n\n— arquivo truncado em 1 MiB —")...)
	}
	return string(body), nil
}

// OpenHistoryFolder abre a pasta benchmarks/ no gerenciador de arquivos do SO.
// Linux: xdg-open. macOS: open. Windows: explorer.
func (b *Bench) OpenHistoryFolder() error {
	dir, err := benchmarksDir()
	if err != nil {
		return err
	}
	return openInFileManager(dir)
}

func openInFileManager(path string) error {
	var cmd *exec.Cmd
	switch {
	case fileManagerExists("xdg-open"):
		cmd = exec.Command("xdg-open", path)
	case fileManagerExists("open"):
		cmd = exec.Command("open", path)
	case fileManagerExists("explorer.exe"):
		cmd = exec.Command("explorer.exe", path)
	default:
		return errors.New("nenhum gerenciador de arquivos disponível")
	}
	return cmd.Start()
}

func fileManagerExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}
