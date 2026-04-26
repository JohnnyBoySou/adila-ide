package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"unicode"
)

// Tiers do pool de buffers usado por readFileBoundedPooled. As capacidades
// foram escolhidas pra cobrir ~95% dos arquivos de código (a maioria cabe em
// 4KB ou 64KB; 1MB acomoda lockfiles e generated bundles). Acima disso, faz
// alloc direto — pôr 5MB no pool segura memória demais por buffer ocioso.
const (
	bufPoolTier1 = 4 * 1024
	bufPoolTier2 = 64 * 1024
	bufPoolTier3 = 1024 * 1024
)

var (
	bufPool1 = sync.Pool{New: func() any { b := make([]byte, bufPoolTier1); return &b }}
	bufPool2 = sync.Pool{New: func() any { b := make([]byte, bufPoolTier2); return &b }}
	bufPool3 = sync.Pool{New: func() any { b := make([]byte, bufPoolTier3); return &b }}
)

// pooledBuf carrega o buffer emprestado e o pool de origem. Mantido como struct
// value (não closure) para que o release seja stack-allocated — closures
// capturando pool+ptr escapavam pra heap, somando ~1 alloc por arquivo lido.
type pooledBuf struct {
	pool *sync.Pool
	buf  *[]byte
}

func (p pooledBuf) release() {
	if p.pool != nil {
		p.pool.Put(p.buf)
	}
}

// readFileBoundedPooled é como readFileBounded mas empresta o buffer de leitura
// de um sync.Pool tiered. O caller precisa chamar release() quando terminar de
// usar `data`. Conteúdo do buffer só é válido entre Get e Put — não retenha
// slices de `data` após release.
//
// Retorna pooledBuf{} quando data == nil ou tem tamanho 0, então é seguro
// chamar `defer p.release()` incondicionalmente.
func readFileBoundedPooled(path string, maxBytes int64) ([]byte, pooledBuf, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, pooledBuf{}, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return nil, pooledBuf{}, err
	}
	if info.IsDir() || info.Size() > maxBytes {
		return nil, pooledBuf{}, nil
	}
	size := info.Size()
	if size == 0 {
		return []byte{}, pooledBuf{}, nil
	}
	var pool *sync.Pool
	switch {
	case size <= bufPoolTier1:
		pool = &bufPool1
	case size <= bufPoolTier2:
		pool = &bufPool2
	case size <= bufPoolTier3:
		pool = &bufPool3
	}
	var data []byte
	var pb pooledBuf
	if pool != nil {
		bufPtr := pool.Get().(*[]byte)
		data = (*bufPtr)[:size]
		pb = pooledBuf{pool: pool, buf: bufPtr}
	} else {
		data = make([]byte, size)
	}
	if _, err := io.ReadFull(f, data); err != nil {
		pb.release()
		return nil, pooledBuf{}, err
	}
	return data, pb, nil
}

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

// matcher abstracts substring/regex matching so o caminho literal possa
// usar bytes.Index (SIMD) ao invés do regex engine.
type matcher interface {
	findAll(data []byte) [][2]int
}

type literalMatcher struct{ needle []byte }

func (m *literalMatcher) findAll(data []byte) [][2]int {
	n := len(m.needle)
	if n == 0 || len(data) < n {
		return nil
	}
	// Lazy alloc: só cria o slice no primeiro hit (com cap pra evitar reallocs
	// nas primeiras 8 ocorrências, caso comum em código).
	var out [][2]int
	base := 0
	for base <= len(data)-n {
		idx := bytes.Index(data[base:], m.needle)
		if idx < 0 {
			break
		}
		abs := base + idx
		if out == nil {
			out = make([][2]int, 0, 8)
		}
		out = append(out, [2]int{abs, abs + n})
		base = abs + n
	}
	return out
}

type literalCIMatcher struct {
	lowerNeedle []byte
	// asciiNeedle indica que lowerNeedle é puro ASCII e podemos fazer fold
	// in-place via bytes.IndexByte(lower) + bytes.IndexByte(upper) no primeiro
	// byte, evitando a cópia inteira do arquivo via bytes.ToLower.
	asciiNeedle bool
}

func (m *literalCIMatcher) findAll(data []byte) [][2]int {
	n := len(m.lowerNeedle)
	if n == 0 || len(data) < n {
		return nil
	}
	if m.asciiNeedle {
		return m.findAllASCII(data)
	}
	// Fallback Unicode: copia ToLower e busca normal.
	lower := bytes.ToLower(data)
	var out [][2]int
	base := 0
	for base <= len(lower)-n {
		idx := bytes.Index(lower[base:], m.lowerNeedle)
		if idx < 0 {
			break
		}
		abs := base + idx
		if out == nil {
			out = make([][2]int, 0, 8)
		}
		out = append(out, [2]int{abs, abs + n})
		base = abs + n
	}
	return out
}

// findAllASCII usa o needle ASCII direto contra data sem alocar uma cópia
// lowercase. O primeiro byte é varrido via bytes.IndexByte (SIMD) para lower
// e upper case; a verificação do resto faz fold byte-a-byte.
func (m *literalCIMatcher) findAllASCII(data []byte) [][2]int {
	n := len(m.lowerNeedle)
	n0 := m.lowerNeedle[0]
	var n0u byte
	if n0 >= 'a' && n0 <= 'z' {
		n0u = n0 - 32
	}
	var out [][2]int
	base := 0
	limit := len(data) - n
	for base <= limit {
		rem := data[base:]
		ix := bytes.IndexByte(rem, n0)
		var i int
		if n0u != 0 {
			iu := bytes.IndexByte(rem, n0u)
			switch {
			case ix < 0 && iu < 0:
				return out
			case ix < 0:
				i = iu
			case iu < 0:
				i = ix
			case ix < iu:
				i = ix
			default:
				i = iu
			}
		} else {
			if ix < 0 {
				return out
			}
			i = ix
		}
		abs := base + i
		if abs > limit {
			return out
		}
		if equalFoldASCII(data[abs:abs+n], m.lowerNeedle) {
			if out == nil {
				out = make([][2]int, 0, 8)
			}
			out = append(out, [2]int{abs, abs + n})
			base = abs + n
		} else {
			base = abs + 1
		}
	}
	return out
}

func equalFoldASCII(s, lowerNeedle []byte) bool {
	for i := 0; i < len(lowerNeedle); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 32
		}
		if c != lowerNeedle[i] {
			return false
		}
	}
	return true
}

func isASCIIBytes(b []byte) bool {
	for _, c := range b {
		if c >= 0x80 {
			return false
		}
	}
	return true
}

type regexMatcher struct{ re *regexp.Regexp }

func (m *regexMatcher) findAll(data []byte) [][2]int {
	raw := m.re.FindAllIndex(data, -1)
	if len(raw) == 0 {
		return nil
	}
	out := make([][2]int, len(raw))
	for i, r := range raw {
		out[i][0] = r[0]
		out[i][1] = r[1]
	}
	return out
}

func buildMatcher(opts SearchOptions) (matcher, error) {
	// Fast path: literal substring sem regex e sem whole-word.
	// Cobre o caso mais comum (Find in Files com texto simples).
	if !opts.Regex && !opts.WholeWord && opts.Query != "" {
		needle := []byte(opts.Query)
		if opts.CaseSensitive {
			return &literalMatcher{needle: needle}, nil
		}
		lower := bytes.ToLower(needle)
		return &literalCIMatcher{
			lowerNeedle: lower,
			asciiNeedle: isASCIIBytes(lower),
		}, nil
	}
	re, err := compileSearchRegex(opts)
	if err != nil {
		return nil, err
	}
	return &regexMatcher{re: re}, nil
}

func looksBinary(b []byte) bool {
	return bytes.IndexByte(b, 0) >= 0
}

func searchFile(path string, m matcher, max int, out *[]SearchMatch) error {
	data, pb, err := readFileBoundedPooled(path, searchMaxFileBytes)
	defer pb.release()
	if err != nil || data == nil {
		return nil
	}
	peek := data
	if len(peek) > searchPeekBytes {
		peek = peek[:searchPeekBytes]
	}
	if looksBinary(peek) {
		return nil
	}

	matches := m.findAll(data)
	if len(matches) == 0 {
		return nil
	}

	// Caminha as linhas com bytes.IndexByte (SIMD) e emite só as que contêm
	// matches. Matches já vêm ordenados por posição.
	lineStart := 0
	lineNum := 1
	mi := 0
	for mi < len(matches) {
		nl := bytes.IndexByte(data[lineStart:], '\n')
		var lineEnd int
		if nl < 0 {
			lineEnd = len(data)
		} else {
			lineEnd = lineStart + nl
		}

		// Pula linhas sem matches.
		if matches[mi][0] >= lineEnd && nl >= 0 {
			lineStart = lineEnd + 1
			lineNum++
			continue
		}

		line := data[lineStart:lineEnd]
		// Preview compartilhado quando a linha cabe inteira: uma única
		// alocação reusada por todos os matches da linha.
		var sharedPreview string
		shortLine := len(line) <= searchPreviewMax
		if shortLine {
			sharedPreview = string(line)
		}
		// Cursor cumulativo p/ utf8ColumnAt: avança byte→col entre matches
		// da mesma linha em vez de re-varrer do índice 0 a cada match.
		colCursor := 1
		byteCursor := 0
		for mi < len(matches) && matches[mi][0] < lineEnd {
			mStart := matches[mi][0] - lineStart
			mEnd := matches[mi][1] - lineStart

			var preview string
			if shortLine {
				preview = sharedPreview
			} else {
				previewStart := mStart - 40
				if previewStart < 0 {
					previewStart = 0
				}
				previewEnd := previewStart + searchPreviewMax
				if previewEnd > len(line) {
					previewEnd = len(line)
				}
				preview = string(line[previewStart:previewEnd])
			}

			if mStart < byteCursor {
				colCursor = 1
				byteCursor = 0
			}
			for byteCursor < mStart {
				_, size := decodeRune(line[byteCursor:])
				if size == 0 {
					break
				}
				byteCursor += size
				colCursor++
			}

			*out = append(*out, SearchMatch{
				Path:    path,
				Line:    lineNum,
				Column:  colCursor,
				Length:  mEnd - mStart,
				Preview: preview,
			})
			if len(*out) >= max {
				return errors.New("max")
			}
			mi++
		}

		if nl < 0 {
			break
		}
		lineStart = lineEnd + 1
		lineNum++
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

	mm, err := buildMatcher(opts)
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

		// Pre-aloca local: poucos hits por subárvore no caso comum (find in files
		// com query específica). 16 evita as primeiras 4 reallocs.
		local := make([]SearchMatch, 0, 16)
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
			if err := searchFile(path, mm, max, &local); err != nil {
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
			if err := searchFile(full, mm, max, &results); err != nil {
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

	replBytes := []byte(replacement)
	process := func(path string) {
		f, err := os.Open(path)
		if err != nil {
			return
		}
		info, err := f.Stat()
		if err != nil {
			f.Close()
			return
		}
		if info.IsDir() || info.Size() > searchMaxFileBytes {
			f.Close()
			return
		}
		size := info.Size()
		data := make([]byte, size)
		if size > 0 {
			if _, err := io.ReadFull(f, data); err != nil {
				f.Close()
				return
			}
		}
		f.Close()
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
		newData := re.ReplaceAll(data, replBytes)
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
