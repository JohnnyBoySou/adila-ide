package main

import (
	"bytes"
	"context"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"unicode"
)

type SearchOptions struct {
	Query         string `json:"query"`
	CaseSensitive bool   `json:"caseSensitive"`
	WholeWord     bool   `json:"wholeWord"`
	Regex         bool   `json:"regex"`
	MaxResults    int    `json:"maxResults"`
}

type SearchMatch struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Column  int    `json:"column"`
	Length  int    `json:"length"`
	Preview string `json:"preview"`
}

const (
	searchMaxFileBytes = 5 * 1024 * 1024
	searchPeekBytes    = 8 * 1024
	searchDefaultMax   = 1000
	searchPreviewMax   = 240
)

func compileSearchRegex(opts SearchOptions) (*regexp.Regexp, error) {
	pattern := opts.Query
	if !opts.Regex {
		pattern = regexp.QuoteMeta(pattern)
	}
	if opts.WholeWord {
		pattern = `\b` + pattern + `\b`
	}
	if !opts.CaseSensitive {
		pattern = "(?i)" + pattern
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	return re, nil
}

func looksBinary(b []byte) bool {
	for _, c := range b {
		if c == 0 {
			return true
		}
	}
	return false
}

func searchFile(path string, re *regexp.Regexp, max int, out *[]SearchMatch) error {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return err
	}
	if info.Size() > searchMaxFileBytes {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	peek := data
	if len(peek) > searchPeekBytes {
		peek = peek[:searchPeekBytes]
	}
	if looksBinary(peek) {
		return nil
	}

	lineStart := 0
	lineNum := 1
	for i := 0; i <= len(data); i++ {
		if i == len(data) || data[i] == '\n' {
			line := data[lineStart:i]
			for _, m := range re.FindAllIndex(line, -1) {
				preview := string(line)
				if len(preview) > searchPreviewMax {
					previewStart := m[0] - 40
					if previewStart < 0 {
						previewStart = 0
					}
					previewEnd := previewStart + searchPreviewMax
					if previewEnd > len(line) {
						previewEnd = len(line)
					}
					preview = string(line[previewStart:previewEnd])
				}
				*out = append(*out, SearchMatch{
					Path:    path,
					Line:    lineNum,
					Column:  utf8ColumnAt(line, m[0]),
					Length:  m[1] - m[0],
					Preview: preview,
				})
				if len(*out) >= max {
					return errors.New("max")
				}
			}
			lineStart = i + 1
			lineNum++
		}
	}
	return nil
}

func utf8ColumnAt(line []byte, byteIdx int) int {
	if byteIdx > len(line) {
		byteIdx = len(line)
	}
	col := 1
	for i := 0; i < byteIdx; {
		_, size := decodeRune(line[i:])
		col++
		i += size
	}
	return col
}

func decodeRune(b []byte) (rune, int) {
	if len(b) == 0 {
		return 0, 0
	}
	if b[0] < 0x80 {
		return rune(b[0]), 1
	}
	for n := 2; n <= 4; n++ {
		if len(b) >= n && (b[0]>>(7-n))&1 == 0 {
			r := rune(b[0] & ((1 << (7 - n)) - 1))
			for i := 1; i < n; i++ {
				r = (r << 6) | rune(b[i]&0x3f)
			}
			return r, n
		}
	}
	return unicode.ReplacementChar, 1
}

// SearchInFiles faz busca recursiva por conteúdo a partir de rootPath.
//
// Estratégia idêntica à SearchFiles: fan-out por subdir com workers limitados
// a runtime.NumCPU(), cancelamento via context quando atinge MaxResults,
// skip de ignoreDirs e dotfiles, skip de binários e arquivos > 5MB.
func (a *App) SearchInFiles(rootPath string, opts SearchOptions) ([]SearchMatch, error) {
	defer bench.Time("App.SearchInFiles")()
	if rootPath == "" || opts.Query == "" {
		return nil, nil
	}
	max := opts.MaxResults
	if max <= 0 || max > searchDefaultMax*5 {
		max = searchDefaultMax
	}

	re, err := compileSearchRegex(opts)
	if err != nil {
		return nil, err
	}

	exc := resolveExcludeFolders(a.cfg)

	ctx, cancel := context.WithCancel(a.ctx)
	defer cancel()

	numWorkers := runtime.NumCPU()
	if numWorkers < 2 {
		numWorkers = 2
	}
	sem := make(chan struct{}, numWorkers)
	ch := make(chan []SearchMatch, numWorkers*2)
	var wg sync.WaitGroup

	walkDir := func(dir string) {
		defer wg.Done()
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			return
		}
		defer func() { <-sem }()

		var local []SearchMatch
		_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, walkErr error) error {
			select {
			case <-ctx.Done():
				return filepath.SkipAll
			default:
			}
			if walkErr != nil {
				return nil
			}
			name := d.Name()
			if strings.HasPrefix(name, ".") || (d.IsDir() && exc[name]) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				return nil
			}
			if err := searchFile(path, re, max, &local); err != nil {
				return filepath.SkipAll
			}
			return nil
		})

		if len(local) == 0 {
			return
		}
		select {
		case ch <- local:
		case <-ctx.Done():
		}
	}

	topEntries, err := os.ReadDir(rootPath)
	if err != nil {
		return nil, err
	}

	var results []SearchMatch
	for _, e := range topEntries {
		name := e.Name()
		if strings.HasPrefix(name, ".") || exc[name] {
			continue
		}
		full := filepath.Join(rootPath, name)
		if !e.IsDir() {
			if err := searchFile(full, re, max, &results); err != nil {
				cancel()
				break
			}
			continue
		}
		wg.Add(1)
		go walkDir(full)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	for batch := range ch {
		results = append(results, batch...)
		if len(results) >= max {
			cancel()
			for range ch {
			}
			break
		}
	}

	if len(results) > max {
		results = results[:max]
	}
	return results, nil
}

// ReplaceInFiles aplica substituição global em todos os arquivos onde a query
// (mesma SearchOptions usada no SearchInFiles) bate. Retorna a quantidade de
// matches substituídos no total (não de arquivos).
func (a *App) ReplaceInFiles(rootPath string, opts SearchOptions, replacement string) (int, error) {
	defer bench.Time("App.ReplaceInFiles")()
	if rootPath == "" || opts.Query == "" {
		return 0, nil
	}
	re, err := compileSearchRegex(opts)
	if err != nil {
		return 0, err
	}

	exc := resolveExcludeFolders(a.cfg)

	var total int
	var mu sync.Mutex

	ctx, cancel := context.WithCancel(a.ctx)
	defer cancel()

	numWorkers := runtime.NumCPU()
	if numWorkers < 2 {
		numWorkers = 2
	}
	sem := make(chan struct{}, numWorkers)
	var wg sync.WaitGroup

	process := func(path string) {
		info, err := os.Stat(path)
		if err != nil || info.IsDir() || info.Size() > searchMaxFileBytes {
			return
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}
		peek := data
		if len(peek) > searchPeekBytes {
			peek = peek[:searchPeekBytes]
		}
		if looksBinary(peek) {
			return
		}
		matches := re.FindAllIndex(data, -1)
		if len(matches) == 0 {
			return
		}
		newData := re.ReplaceAll(data, []byte(replacement))
		if bytes.Equal(newData, data) {
			return
		}
		if err := os.WriteFile(path, newData, info.Mode().Perm()); err != nil {
			return
		}
		mu.Lock()
		total += len(matches)
		mu.Unlock()
	}

	walkDir := func(dir string) {
		defer wg.Done()
		select {
		case sem <- struct{}{}:
		case <-ctx.Done():
			return
		}
		defer func() { <-sem }()

		_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, walkErr error) error {
			select {
			case <-ctx.Done():
				return filepath.SkipAll
			default:
			}
			if walkErr != nil {
				return nil
			}
			name := d.Name()
			if strings.HasPrefix(name, ".") || (d.IsDir() && exc[name]) {
				if d.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			if d.IsDir() {
				return nil
			}
			process(path)
			return nil
		})
	}

	topEntries, err := os.ReadDir(rootPath)
	if err != nil {
		return 0, err
	}
	for _, e := range topEntries {
		name := e.Name()
		if strings.HasPrefix(name, ".") || exc[name] {
			continue
		}
		full := filepath.Join(rootPath, name)
		if !e.IsDir() {
			process(full)
			continue
		}
		wg.Add(1)
		go walkDir(full)
	}
	wg.Wait()
	return total, nil
}
