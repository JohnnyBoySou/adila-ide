package main

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type LSPServerStatus struct {
	Lang        string `json:"lang"`
	Name        string `json:"name"`
	Installed   bool   `json:"installed"`
	Path        string `json:"path"`
	InstallHint string `json:"installHint"`
}

// installStrategy descreve como instalar cada servidor.
type installStrategy struct {
	name       string
	binaryName string
	install    func(l *LSP) error
	hint       string // mostrado quando Go/Rust não estão disponíveis
}

var strategies = map[string]installStrategy{
	"gopls": {
		name:       "Go (gopls)",
		binaryName: "gopls",
		install:    installGopls,
		hint:       "Requer Go instalado: https://go.dev/dl/",
	},
	"rust-analyzer": {
		name:       "Rust (rust-analyzer)",
		binaryName: "rust-analyzer",
		install:    installRustAnalyzer,
		hint:       "Requer Rust instalado: https://rustup.rs/",
	},
	"typescript-language-server": {
		name:       "TypeScript (typescript-language-server)",
		binaryName: "typescript-language-server",
		install:    installTypescriptLanguageServer,
		hint:       "Requer Node.js (npm) ou Bun instalado",
	},
}

// lspInstallDir retorna ~/.config/adila/lsp-servers, criando se necessário.
func lspInstallDir() (string, error) {
	cfg, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(cfg, "adila", "lsp-servers")
	return dir, os.MkdirAll(dir, 0o755)
}

// managedBinPath devolve o caminho do binário gerenciado, se instalado.
//
// No Windows tenta .exe e .cmd nessa ordem — alguns servidores (ex: o wrapper
// do typescript-language-server) são .cmd em vez de .exe nativo.
func managedBinPath(binaryName string) string {
	dir, err := lspInstallDir()
	if err != nil {
		return ""
	}
	candidates := []string{binaryName}
	if runtime.GOOS == "windows" {
		candidates = []string{binaryName + ".exe", binaryName + ".cmd"}
	}
	for _, name := range candidates {
		p := filepath.Join(dir, name)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// GetLSPStatus retorna status de instalação dos servidores gerenciados.
func (l *LSP) GetLSPStatus() []LSPServerStatus {
	out := make([]LSPServerStatus, 0, len(strategies))
	for lang, s := range strategies {
		// prioridade: binário gerenciado → PATH do sistema
		path := managedBinPath(s.binaryName)
		if path == "" {
			l.mu.Lock()
			path = l.resolveBin(lang, lspServers[lang], "")
			l.mu.Unlock()
		}

		hint := ""
		if path == "" {
			hint = s.hint
		}

		out = append(out, LSPServerStatus{
			Lang:        lang,
			Name:        s.name,
			Installed:   path != "",
			Path:        path,
			InstallHint: hint,
		})
	}
	return out
}

// InstallLSPServer instala o servidor para a linguagem dada.
// Emite "lsp:install:progress:{lang}" (0–100) e "lsp:install:done:{lang}".
func (l *LSP) InstallLSPServer(lang string) error {
	s, ok := strategies[lang]
	if !ok {
		return fmt.Errorf("servidor desconhecido: %s", lang)
	}
	if err := s.install(l); err != nil {
		emit("lsp:install:error:"+lang, err.Error())
		return err
	}
	// atualiza cache
	path := managedBinPath(s.binaryName)
	l.mu.Lock()
	if path != "" {
		l.available[lang] = path
	}
	l.mu.Unlock()
	emit("lsp:install:done:"+lang, path)
	return nil
}

// --- gopls: go install golang.org/x/tools/gopls@latest ---

func installGopls(l *LSP) error {
	goBin, err := exec.LookPath("go")
	if err != nil {
		return fmt.Errorf("Go não encontrado no PATH — instale em https://go.dev/dl/")
	}

	dir, err := lspInstallDir()
	if err != nil {
		return err
	}

	l.emitProgress("gopls", 10)

	// GOBIN aponta pro nosso diretório gerenciado
	cmd := exec.Command(goBin, "install", "golang.org/x/tools/gopls@latest")
	cmd.Env = append(os.Environ(), "GOBIN="+dir)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	l.emitProgress("gopls", 20)

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("go install gopls: %s", strings.TrimSpace(stderr.String()))
	}

	l.emitProgress("gopls", 100)
	return nil
}

// --- rust-analyzer: download binário do GitHub Releases ---
// https://github.com/rust-lang/rust-analyzer/releases

const rustAnalyzerVersion = "2025-04-14"

func rustAnalyzerURL() (string, string) {
	goos := runtime.GOOS
	goarch := runtime.GOARCH

	archMap := map[string]string{"amd64": "x86_64", "arm64": "aarch64"}
	arch := archMap[goarch]
	if arch == "" {
		arch = goarch
	}

	base := fmt.Sprintf(
		"https://github.com/rust-lang/rust-analyzer/releases/download/%s/rust-analyzer-",
		rustAnalyzerVersion,
	)

	switch goos {
	case "linux":
		return base + arch + "-unknown-linux-gnu.gz", "gz"
	case "darwin":
		return base + arch + "-apple-darwin.gz", "gz"
	case "windows":
		return base + arch + "-pc-windows-msvc.zip", "zip"
	default:
		return "", ""
	}
}

func installRustAnalyzer(l *LSP) error {
	url, format := rustAnalyzerURL()
	if url == "" {
		return fmt.Errorf("plataforma não suportada: %s/%s", runtime.GOOS, runtime.GOARCH)
	}

	dir, err := lspInstallDir()
	if err != nil {
		return err
	}

	binName := "rust-analyzer"
	if runtime.GOOS == "windows" {
		binName += ".exe"
	}
	destPath := filepath.Join(dir, binName)

	logInfof("LSP install: baixando rust-analyzer de %s", url)
	l.emitProgress("rust-analyzer", 5)

	resp, err := http.Get(url) //nolint:gosec
	if err != nil {
		return fmt.Errorf("download falhou: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download falhou: HTTP %d para %s", resp.StatusCode, url)
	}

	body := &progressReader{
		r:     resp.Body,
		total: resp.ContentLength,
		onProgress: func(pct int) {
			l.emitProgress("rust-analyzer", 5+int(float64(pct)*0.85))
		},
	}

	switch format {
	case "gz":
		if err := extractGz(body, destPath); err != nil {
			return fmt.Errorf("extração gz: %w", err)
		}
	case "zip":
		// zip precisa de seek — buffer em memória primeiro
		data, err := io.ReadAll(body)
		if err != nil {
			return fmt.Errorf("leitura zip: %w", err)
		}
		if err := extractZipBytes(data, binName, destPath); err != nil {
			return fmt.Errorf("extração zip: %w", err)
		}
	}

	if err := os.Chmod(destPath, 0o755); err != nil {
		return err
	}

	l.emitProgress("rust-analyzer", 100)
	return nil
}

// --- helpers de extração ---

func extractGz(r io.Reader, dest string) error {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return err
	}
	defer gz.Close()
	return writeFile(gz, dest)
}

func extractZipBytes(data []byte, binName, dest string) error {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}
	for _, f := range zr.File {
		if filepath.Base(f.Name) == binName {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			defer rc.Close()
			return writeFile(rc, dest)
		}
	}
	return fmt.Errorf("binário %q não encontrado no zip", binName)
}

func writeFile(r io.Reader, dest string) error {
	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

func (l *LSP) emitProgress(lang string, pct int) {
	emit("lsp:install:progress:"+lang, pct)
}

type progressReader struct {
	r          io.Reader
	total      int64
	read       int64
	lastPct    int
	onProgress func(pct int)
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.r.Read(p)
	if n > 0 && pr.total > 0 {
		pr.read += int64(n)
		pct := int(pr.read * 100 / pr.total)
		if pct > pr.lastPct {
			pr.lastPct = pct
			pr.onProgress(pct)
		}
	}
	return n, err
}

// --- typescript-language-server: npm install --prefix <dir> ---
//
// O typescript-language-server requer também o pacote `typescript` (tsserver)
// como dependência runtime. Instalamos os dois localmente em
// ~/.config/adila/lsp-servers/node_modules e criamos um wrapper executável
// em <dir>/typescript-language-server pra integrar com managedBinPath.

func installTypescriptLanguageServer(l *LSP) error {
	dir, err := lspInstallDir()
	if err != nil {
		return err
	}

	npm, npmErr := exec.LookPath("npm")
	bun, bunErr := exec.LookPath("bun")
	if npmErr != nil && bunErr != nil {
		return fmt.Errorf("nem npm nem bun encontrados no PATH — instale Node.js ou Bun")
	}

	l.emitProgress("typescript-language-server", 5)

	// package.json mínimo evita warnings do npm/bun em diretório vazio.
	pkgPath := filepath.Join(dir, "package.json")
	if _, statErr := os.Stat(pkgPath); os.IsNotExist(statErr) {
		_ = os.WriteFile(pkgPath, []byte(`{"name":"adila-lsp","private":true}`), 0o644)
	}

	l.emitProgress("typescript-language-server", 15)

	var cmd *exec.Cmd
	if npmErr == nil {
		cmd = exec.Command(npm, "install", "--prefix", dir,
			"typescript-language-server", "typescript")
	} else {
		cmd = exec.Command(bun, "add", "--cwd", dir,
			"typescript-language-server", "typescript")
	}

	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Env = append(os.Environ(), "NPM_CONFIG_FUND=false", "NPM_CONFIG_AUDIT=false")

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("instalação falhou: %s",
			strings.TrimSpace(stderr.String()))
	}

	l.emitProgress("typescript-language-server", 80)

	// Cria wrapper executável em <dir>/typescript-language-server que invoca
	// node_modules/.bin/typescript-language-server. managedBinPath espera o
	// arquivo nesse caminho exato.
	if err := writeTSWrapper(dir); err != nil {
		return fmt.Errorf("criar wrapper: %w", err)
	}

	l.emitProgress("typescript-language-server", 100)
	return nil
}

func writeTSWrapper(dir string) error {
	target := filepath.Join(dir, "node_modules", ".bin", "typescript-language-server")
	wrapper := filepath.Join(dir, "typescript-language-server")

	if runtime.GOOS == "windows" {
		target += ".cmd"
		wrapper += ".cmd"
		script := fmt.Sprintf("@echo off\r\n\"%s\" %%*\r\n", target)
		return os.WriteFile(wrapper, []byte(script), 0o644)
	}

	script := fmt.Sprintf("#!/bin/sh\nexec %q \"$@\"\n", target)
	return os.WriteFile(wrapper, []byte(script), 0o755)
}
