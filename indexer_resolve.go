package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// indexer_resolve.go implementa resolução de imports JS/TS (paths/aliases
// do tsconfig + extensões padrão + /index.<ext>) usado pelo "Go to
// Definition" do CodeEditor. Cache simples por workspace pra evitar
// reparser do tsconfig em cada Ctrl+Click.

// Lista de extensões probadas em ordem. Espelha o que o TypeScript faz
// (TS antes de JS, .tsx antes de .ts) — assim um import "@/Foo" prefere
// Foo.tsx caso ambos coexistam.
var importExtensions = []string{
	".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".mts", ".cts", ".json",
}

// ResolveImport recebe o arquivo origem (absoluto) e a especificação do
// módulo ("@/components/Foo", "./bar", "../utils") e devolve o path
// absoluto resolvido. Strings vazias indicam "não foi possível resolver"
// — o frontend trata como sem definição.
//
// Imports de pacotes (sem prefixo "./" "/" ou "@/" mapeado) são ignorados:
// nesse MVP não tentamos navegar pra dentro de node_modules.
func (i *Indexer) ResolveImport(currentFile, moduleSpec string) (string, error) {
	moduleSpec = strings.TrimSpace(moduleSpec)
	if moduleSpec == "" || currentFile == "" {
		return "", nil
	}
	i.mu.Lock()
	root := i.workdir
	i.mu.Unlock()
	if root == "" {
		return "", nil
	}

	// Imports relativos: resolvem contra o diretório do arquivo origem.
	if strings.HasPrefix(moduleSpec, "./") || strings.HasPrefix(moduleSpec, "../") {
		base := filepath.Dir(currentFile)
		return resolveOnDisk(filepath.Join(base, moduleSpec))
	}

	// Imports absolutos no filesystem (raros mas possíveis).
	if filepath.IsAbs(moduleSpec) {
		return resolveOnDisk(moduleSpec)
	}

	// Aliases via tsconfig/jsconfig paths. Carregamos uma vez por workspace
	// e cacheamos; mudanças ao tsconfig precisam de Reindex pra serem vistas.
	cfg := i.tsConfigFor(root)
	if cfg != nil {
		if rewritten, ok := cfg.match(moduleSpec); ok {
			return resolveOnDisk(filepath.Join(cfg.baseDir, rewritten))
		}
	}

	// Heurística: muitos projetos Next.js/Vite usam "@/X" mapeado pra "src/X"
	// sem que o tsconfig tenha sido lido (ex.: jsconfig em sub-pasta). Tenta
	// como fallback antes de desistir.
	if strings.HasPrefix(moduleSpec, "@/") {
		rest := strings.TrimPrefix(moduleSpec, "@/")
		for _, prefix := range []string{"src", "."} {
			if p, _ := resolveOnDisk(filepath.Join(root, prefix, rest)); p != "" {
				return p, nil
			}
		}
	}

	// Bare specifiers (ex.: "react") — não navegamos.
	return "", nil
}

// resolveOnDisk tenta o path como-é, depois testa cada extensão e por fim
// path/index.<ext>. Devolve string vazia se nada existir.
func resolveOnDisk(path string) (string, error) {
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		abs, err := filepath.Abs(path)
		if err != nil {
			return "", err
		}
		return abs, nil
	}
	for _, ext := range importExtensions {
		candidate := path + ext
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return filepath.Abs(candidate)
		}
	}
	for _, ext := range importExtensions {
		candidate := filepath.Join(path, "index"+ext)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return filepath.Abs(candidate)
		}
	}
	return "", nil
}

// ── tsconfig cache ────────────────────────────────────────────────────────

// tsconfigPaths é o subset que precisamos do tsconfig.json: baseUrl + paths.
type tsconfigPaths struct {
	baseDir string             // diretório onde baseUrl resolve (absoluto)
	rules   []tsconfigPathRule // ordenados como definidos
}

type tsconfigPathRule struct {
	prefix     string // ex.: "@/" (tudo antes do "*")
	suffix     string // ex.: "" (depois do "*"; raro ter)
	target     string // ex.: "src/" (relativo ao baseDir)
	exact      bool   // se a regra não tem "*"
	exactValue string // valor literal pro alias exato (sem wildcard)
}

func (p *tsconfigPaths) match(moduleSpec string) (string, bool) {
	for _, r := range p.rules {
		if r.exact {
			if moduleSpec == r.exactValue {
				return r.target, true
			}
			continue
		}
		if strings.HasPrefix(moduleSpec, r.prefix) && strings.HasSuffix(moduleSpec, r.suffix) {
			middle := moduleSpec[len(r.prefix) : len(moduleSpec)-len(r.suffix)]
			return strings.Replace(r.target, "*", middle, 1), true
		}
	}
	return "", false
}

// Cache global por root path. Não sentimos a falta de invalidação porque o
// frontend só lida com um workspace por vez; troca de workdir reinicia o
// indexer (que possui sua própria instância) — esse cache é compartilhado
// pra simplicidade mas só tem entradas pelos roots já vistos.
var (
	tsconfigCacheMu sync.Mutex
	tsconfigCache   = map[string]*tsconfigPaths{}
)

// tsConfigFor lê tsconfig.json (ou jsconfig.json) do root. Devolve nil se
// nenhum existir ou se o JSON for inválido — chamadores tratam como "sem
// aliases configurados".
func (i *Indexer) tsConfigFor(root string) *tsconfigPaths {
	tsconfigCacheMu.Lock()
	defer tsconfigCacheMu.Unlock()
	if cached, ok := tsconfigCache[root]; ok {
		return cached
	}
	for _, name := range []string{"tsconfig.json", "jsconfig.json"} {
		p := filepath.Join(root, name)
		if cfg, err := loadTsconfigPaths(p); err == nil && cfg != nil {
			tsconfigCache[root] = cfg
			return cfg
		}
	}
	tsconfigCache[root] = nil
	return nil
}

// loadTsconfigPaths extrai compilerOptions.baseUrl + compilerOptions.paths.
// O parser é tolerante a campos desconhecidos. Comentários (// e /* */) são
// removidos antes de json.Unmarshal porque tsconfig permite JSONC.
func loadTsconfigPaths(path string) (*tsconfigPaths, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	cleaned := stripJSONComments(raw)
	var doc struct {
		CompilerOptions struct {
			BaseUrl string              `json:"baseUrl"`
			Paths   map[string][]string `json:"paths"`
		} `json:"compilerOptions"`
	}
	if err := json.Unmarshal(cleaned, &doc); err != nil {
		return nil, err
	}
	baseDir := filepath.Dir(path)
	if doc.CompilerOptions.BaseUrl != "" {
		baseDir = filepath.Join(baseDir, doc.CompilerOptions.BaseUrl)
	}
	out := &tsconfigPaths{baseDir: baseDir}
	for alias, targets := range doc.CompilerOptions.Paths {
		if len(targets) == 0 {
			continue
		}
		// Pegamos só o primeiro target — a especificação permite uma lista
		// pra ordem de fallback, mas pra "go to definition" o primeiro é
		// quase sempre o canônico.
		target := targets[0]
		if strings.Contains(alias, "*") {
			star := strings.Index(alias, "*")
			out.rules = append(out.rules, tsconfigPathRule{
				prefix: alias[:star],
				suffix: alias[star+1:],
				target: target,
			})
		} else {
			out.rules = append(out.rules, tsconfigPathRule{
				exact:      true,
				exactValue: alias,
				target:     target,
			})
		}
	}
	if len(out.rules) == 0 && doc.CompilerOptions.BaseUrl == "" {
		return nil, errors.New("tsconfig sem baseUrl/paths")
	}
	return out, nil
}

// stripJSONComments remove comentários // e /* */ de um JSONC. Não trata
// strings com sequências `//` corretamente em todos os casos extremos
// (impossível sem parser real), mas cobre 99% dos tsconfigs reais.
func stripJSONComments(raw []byte) []byte {
	out := make([]byte, 0, len(raw))
	i := 0
	for i < len(raw) {
		c := raw[i]
		if c == '"' {
			// pula string literal preservando como-é, escapando \" .
			out = append(out, c)
			i++
			for i < len(raw) {
				if raw[i] == '\\' && i+1 < len(raw) {
					out = append(out, raw[i], raw[i+1])
					i += 2
					continue
				}
				out = append(out, raw[i])
				if raw[i] == '"' {
					i++
					break
				}
				i++
			}
			continue
		}
		if c == '/' && i+1 < len(raw) {
			if raw[i+1] == '/' {
				// linha comment
				for i < len(raw) && raw[i] != '\n' {
					i++
				}
				continue
			}
			if raw[i+1] == '*' {
				i += 2
				for i+1 < len(raw) && !(raw[i] == '*' && raw[i+1] == '/') {
					i++
				}
				i += 2
				continue
			}
		}
		out = append(out, c)
		i++
	}
	return out
}
