package vt

import "sync"

// Cell representa uma célula da grade visível com glyph + atributos.
type Cell struct {
	R    rune
	FG   uint32 // RGBA, 0 = default
	BG   uint32
	Bold bool
}

// Screen é o estado de uma sessão de terminal: grade visível, scrollback
// ring, posição do cursor e atributos correntes. Acessos cross-goroutine
// passam por mu — o parser feed roda na goroutine de leitura do PTY,
// o renderer lê na goroutine de UI.
type Screen struct {
	mu sync.RWMutex

	cols, rows int
	cells      []Cell // visible grid: rows*cols, row-major
	scroll     [][]Cell
	maxScroll  int

	cx, cy int // cursor
	curFG  uint32
	curBG  uint32
	bold   bool
	dirty  uint64 // contador, frontend usa pra decidir se re-renderiza

	// Callback opcional disparado quando há mudança visível.
	onDirty func()
}

func NewScreen(cols, rows int) *Screen {
	s := &Screen{
		cols:      cols,
		rows:      rows,
		maxScroll: 5000,
	}
	s.cells = make([]Cell, cols*rows)
	return s
}

func (s *Screen) SetOnDirty(fn func()) { s.onDirty = fn }

func (s *Screen) Size() (cols, rows int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cols, s.rows
}

// Resize redimensiona preservando o conteúdo atual (truncado/preenchido).
// Layout simplificado: linhas existentes mantém posição superior-esquerda.
func (s *Screen) Resize(cols, rows int) {
	if cols <= 0 || rows <= 0 {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if cols == s.cols && rows == s.rows {
		return
	}
	next := make([]Cell, cols*rows)
	for y := 0; y < rows && y < s.rows; y++ {
		for x := 0; x < cols && x < s.cols; x++ {
			next[y*cols+x] = s.cells[y*s.cols+x]
		}
	}
	s.cells = next
	s.cols = cols
	s.rows = rows
	if s.cx >= cols {
		s.cx = cols - 1
	}
	if s.cy >= rows {
		s.cy = rows - 1
	}
	s.markDirty()
}

func (s *Screen) markDirty() {
	s.dirty++
	if s.onDirty != nil {
		s.onDirty()
	}
}

// Snapshot copia o estado visível pra renderização sem segurar o lock.
// Retorna grid (rows*cols), cursor, e o counter dirty.
func (s *Screen) Snapshot() (cells []Cell, cols, rows, cx, cy int, dirty uint64) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Cell, len(s.cells))
	copy(out, s.cells)
	return out, s.cols, s.rows, s.cx, s.cy, s.dirty
}

// ── Handler interface (parser → screen) ──

func (s *Screen) Print(r rune) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cx >= s.cols {
		s.newline()
		s.cx = 0
	}
	idx := s.cy*s.cols + s.cx
	if idx >= 0 && idx < len(s.cells) {
		s.cells[idx] = Cell{R: r, FG: s.curFG, BG: s.curBG, Bold: s.bold}
	}
	s.cx++
	s.markDirty()
}

func (s *Screen) Execute(b byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch b {
	case '\r':
		s.cx = 0
	case '\n':
		s.newline()
	case '\b':
		if s.cx > 0 {
			s.cx--
		}
	case '\t':
		s.cx = ((s.cx / 8) + 1) * 8
		if s.cx >= s.cols {
			s.cx = s.cols - 1
		}
	case 0x07:
		// bell — ignora (TODO: visual flash)
	}
	s.markDirty()
}

// newline assume mu segurado.
func (s *Screen) newline() {
	s.cy++
	if s.cy >= s.rows {
		// rola: empurra a linha 0 pro scrollback, shiftar todo o resto.
		first := make([]Cell, s.cols)
		copy(first, s.cells[:s.cols])
		s.scroll = append(s.scroll, first)
		if len(s.scroll) > s.maxScroll {
			s.scroll = s.scroll[len(s.scroll)-s.maxScroll:]
		}
		copy(s.cells, s.cells[s.cols:])
		// limpa última linha
		last := s.cells[(s.rows-1)*s.cols:]
		for i := range last {
			last[i] = Cell{}
		}
		s.cy = s.rows - 1
	}
}

func (s *Screen) CSI(final byte, params []int, intermediates []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := func(i, def int) int {
		if i < len(params) && params[i] > 0 {
			return params[i]
		}
		return def
	}
	switch final {
	case 'H', 'f': // CUP — cursor position (1-based)
		s.cy = p(0, 1) - 1
		s.cx = p(1, 1) - 1
		s.clampCursor()
	case 'A':
		s.cy -= p(0, 1)
		s.clampCursor()
	case 'B':
		s.cy += p(0, 1)
		s.clampCursor()
	case 'C':
		s.cx += p(0, 1)
		s.clampCursor()
	case 'D':
		s.cx -= p(0, 1)
		s.clampCursor()
	case 'J': // ED — erase display
		mode := p(0, 0)
		s.eraseDisplay(mode)
	case 'K': // EL — erase line
		mode := p(0, 0)
		s.eraseLine(mode)
	case 'm': // SGR
		s.applySGR(params)
	}
	s.markDirty()
}

func (s *Screen) clampCursor() {
	if s.cx < 0 {
		s.cx = 0
	}
	if s.cy < 0 {
		s.cy = 0
	}
	if s.cx >= s.cols {
		s.cx = s.cols - 1
	}
	if s.cy >= s.rows {
		s.cy = s.rows - 1
	}
}

func (s *Screen) eraseDisplay(mode int) {
	switch mode {
	case 0: // do cursor até o fim
		start := s.cy*s.cols + s.cx
		for i := start; i < len(s.cells); i++ {
			s.cells[i] = Cell{}
		}
	case 1: // do início até o cursor
		end := s.cy*s.cols + s.cx + 1
		for i := 0; i < end && i < len(s.cells); i++ {
			s.cells[i] = Cell{}
		}
	case 2, 3: // tela toda
		for i := range s.cells {
			s.cells[i] = Cell{}
		}
	}
}

func (s *Screen) eraseLine(mode int) {
	row := s.cy * s.cols
	switch mode {
	case 0:
		for x := s.cx; x < s.cols; x++ {
			s.cells[row+x] = Cell{}
		}
	case 1:
		for x := 0; x <= s.cx && x < s.cols; x++ {
			s.cells[row+x] = Cell{}
		}
	case 2:
		for x := 0; x < s.cols; x++ {
			s.cells[row+x] = Cell{}
		}
	}
}

// applySGR aplica Select Graphic Rendition (cores e atributos).
// Subset coberto: reset, bold, fg/bg 16 cores básicas, fg/bg 256 (38;5;n / 48;5;n),
// fg/bg truecolor (38;2;r;g;b / 48;2;r;g;b).
func (s *Screen) applySGR(params []int) {
	if len(params) == 0 {
		s.curFG, s.curBG, s.bold = 0, 0, false
		return
	}
	for i := 0; i < len(params); i++ {
		p := params[i]
		switch {
		case p == 0:
			s.curFG, s.curBG, s.bold = 0, 0, false
		case p == 1:
			s.bold = true
		case p == 22:
			s.bold = false
		case p >= 30 && p <= 37:
			s.curFG = ansi16(p - 30)
		case p == 39:
			s.curFG = 0
		case p >= 40 && p <= 47:
			s.curBG = ansi16(p - 40)
		case p == 49:
			s.curBG = 0
		case p >= 90 && p <= 97:
			s.curFG = ansi16(p - 90 + 8)
		case p >= 100 && p <= 107:
			s.curBG = ansi16(p - 100 + 8)
		case p == 38 || p == 48:
			if i+1 >= len(params) {
				return
			}
			mode := params[i+1]
			if mode == 5 && i+2 < len(params) {
				c := ansi256(params[i+2])
				if p == 38 {
					s.curFG = c
				} else {
					s.curBG = c
				}
				i += 2
			} else if mode == 2 && i+4 < len(params) {
				c := rgba(params[i+2], params[i+3], params[i+4], 0xff)
				if p == 38 {
					s.curFG = c
				} else {
					s.curBG = c
				}
				i += 4
			}
		}
	}
}

func (s *Screen) OSC(_ []byte)         { /* títulos/links — TODO */ }
func (s *Screen) ESC(_ byte, _ []byte) { /* charset, RIS, etc — TODO */ }

// ── Helpers de cor ──

var ansi16Table = [16]uint32{
	rgba(0x09, 0x09, 0x0b, 0xff), // black
	rgba(0xf8, 0x71, 0x71, 0xff), // red
	rgba(0x4a, 0xde, 0x80, 0xff), // green
	rgba(0xfb, 0xbf, 0x24, 0xff), // yellow
	rgba(0x60, 0xa5, 0xfa, 0xff), // blue
	rgba(0xc0, 0x84, 0xfc, 0xff), // magenta
	rgba(0x22, 0xd3, 0xee, 0xff), // cyan
	rgba(0xe4, 0xe4, 0xe7, 0xff), // white
	rgba(0x52, 0x52, 0x5b, 0xff), // bright black
	rgba(0xfc, 0xa5, 0xa5, 0xff), // bright red
	rgba(0x86, 0xef, 0xac, 0xff), // bright green
	rgba(0xfc, 0xd3, 0x4d, 0xff), // bright yellow
	rgba(0x93, 0xc5, 0xfd, 0xff), // bright blue
	rgba(0xd8, 0xb4, 0xfe, 0xff), // bright magenta
	rgba(0x67, 0xe8, 0xf9, 0xff), // bright cyan
	rgba(0xfa, 0xfa, 0xfa, 0xff), // bright white
}

func ansi16(idx int) uint32 {
	if idx < 0 || idx > 15 {
		return 0
	}
	return ansi16Table[idx]
}

func ansi256(idx int) uint32 {
	if idx < 0 || idx > 255 {
		return 0
	}
	if idx < 16 {
		return ansi16Table[idx]
	}
	if idx >= 232 {
		// gray ramp
		v := uint32(8 + (idx-232)*10)
		return rgba(int(v), int(v), int(v), 0xff)
	}
	// 6x6x6 cube
	c := idx - 16
	r := (c / 36) % 6
	g := (c / 6) % 6
	b := c % 6
	step := []int{0, 0x5f, 0x87, 0xaf, 0xd7, 0xff}
	return rgba(step[r], step[g], step[b], 0xff)
}

func rgba(r, g, b, a int) uint32 {
	return uint32(r&0xff)<<24 | uint32(g&0xff)<<16 | uint32(b&0xff)<<8 | uint32(a&0xff)
}
