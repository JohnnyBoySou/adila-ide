package main

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type ShellInfo struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Avail bool   `json:"avail"`
}

// ListShells devolve todos os shells disponíveis no sistema.
func (t *Terminal) ListShells() []ShellInfo {
	if runtime.GOOS == "windows" {
		return listShellsWindows()
	}
	return listShellsUnix()
}

func listShellsUnix() []ShellInfo {
	seen := map[string]bool{}
	var shells []ShellInfo

	add := func(path string) {
		path = strings.TrimSpace(path)
		if path == "" || strings.HasPrefix(path, "#") {
			return
		}
		if seen[path] {
			return
		}
		if _, err := os.Stat(path); err != nil {
			return
		}
		seen[path] = true
		shells = append(shells, ShellInfo{
			Path:  path,
			Name:  filepath.Base(path),
			Avail: true,
		})
	}

	// /etc/shells é a fonte canônica no Linux/macOS
	if f, err := os.Open("/etc/shells"); err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			add(scanner.Text())
		}
		_ = f.Close()
	}

	// adiciona shell atual e candidatos comuns caso não estejam em /etc/shells
	for _, candidate := range []string{
		os.Getenv("SHELL"),
		"/bin/bash",
		"/usr/bin/bash",
		"/bin/zsh",
		"/usr/bin/zsh",
		"/usr/bin/fish",
		"/usr/local/bin/fish",
		"/bin/sh",
		"/bin/dash",
	} {
		add(candidate)
	}

	return shells
}

func listShellsWindows() []ShellInfo {
	var shells []ShellInfo
	candidates := []struct{ path, name string }{
		{os.Getenv("COMSPEC"), "cmd"},
		{`C:\Windows\System32\cmd.exe`, "cmd"},
		{`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, "powershell"},
		{`C:\Program Files\PowerShell\7\pwsh.exe`, "pwsh"},
	}
	seen := map[string]bool{}
	for _, c := range candidates {
		p := strings.TrimSpace(c.path)
		if p == "" || seen[p] {
			continue
		}
		if _, err := os.Stat(p); err != nil {
			continue
		}
		seen[p] = true
		shells = append(shells, ShellInfo{Path: p, Name: c.name, Avail: true})
	}
	return shells
}

// --- Config persistida ---

type adilaConfig struct {
	DefaultShell string `json:"defaultShell"`
}

func configFilePath() (string, error) {
	cfg, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(cfg, "adila")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "config.json"), nil
}

func loadConfig() adilaConfig {
	path, err := configFilePath()
	if err != nil {
		return adilaConfig{}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return adilaConfig{}
	}
	var cfg adilaConfig
	_ = json.Unmarshal(data, &cfg)
	return cfg
}

func saveConfig(cfg adilaConfig) error {
	path, err := configFilePath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (t *Terminal) GetDefaultShell() string {
	cfg := loadConfig()
	if cfg.DefaultShell != "" {
		if _, err := os.Stat(cfg.DefaultShell); err == nil {
			return cfg.DefaultShell
		}
	}
	return defaultShell()
}

func (t *Terminal) SetDefaultShell(path string) error {
	if _, err := os.Stat(path); err != nil {
		return err
	}
	cfg := loadConfig()
	cfg.DefaultShell = path
	return saveConfig(cfg)
}
