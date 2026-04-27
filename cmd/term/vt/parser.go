// Package vt implementa um parser ANSI/VT mínimo voltado a alimentar
// um Screen com texto visível e atributos básicos. Não é completo —
// evolui conforme o terminal precisar.
//
// State machine seguindo VT500-Series Programmer Reference:
//
//	GROUND → recebe texto puro
//	ESCAPE → recebeu \x1b, espera próximo byte
//	CSI    → \x1b[ — Control Sequence Introducer (cursor, SGR, etc)
//	OSC    → \x1b] — Operating System Command (titles, links, OSC 7/133)
//
// Bytes 0x20..0x7e em GROUND são printables. Resto vai pro Screen via
// callbacks tipados.
package vt

import "unicode/utf8"

// Handler é o consumidor dos eventos parseados. Implementação típica é
// o Screen, que aplica cada operação no grid.
type Handler interface {
	Print(r rune)
	Execute(b byte) // C0 controls (\b, \t, \n, \r, ...)
	CSI(final byte, params []int, intermediates []byte)
	OSC(data []byte)
	ESC(final byte, intermediates []byte)
}

type state int

const (
	stGround state = iota
	stEscape
	stCSIParam
	stCSIInter
	stOSC
)

type Parser struct {
	h        Handler
	st       state
	params   []int
	curParam int
	hasParam bool
	inter    []byte
	osc      []byte

	// utf8 staging — bytes parciais entre chamadas
	utf8Buf [4]byte
	utf8N   int
}

func New(h Handler) *Parser {
	return &Parser{h: h}
}

// Write injeta uma rajada de bytes vinda do PTY.
func (p *Parser) Write(b []byte) {
	for i := 0; i < len(b); i++ {
		p.feed(b[i])
	}
}

func (p *Parser) reset() {
	p.params = p.params[:0]
	p.curParam = 0
	p.hasParam = false
	p.inter = p.inter[:0]
	p.osc = p.osc[:0]
}

func (p *Parser) commitParam() {
	if p.hasParam {
		p.params = append(p.params, p.curParam)
	} else {
		p.params = append(p.params, 0)
	}
	p.curParam = 0
	p.hasParam = false
}

func (p *Parser) feed(c byte) {
	// Escape e CAN/SUB cancelam qualquer sequência em andamento.
	if c == 0x18 || c == 0x1a {
		p.reset()
		p.st = stGround
		return
	}
	if c == 0x1b && p.st != stOSC {
		p.reset()
		p.st = stEscape
		return
	}

	switch p.st {
	case stGround:
		p.ground(c)
	case stEscape:
		p.escape(c)
	case stCSIParam:
		p.csiParam(c)
	case stCSIInter:
		p.csiInter(c)
	case stOSC:
		p.oscByte(c)
	}
}

func (p *Parser) ground(c byte) {
	if c < 0x20 {
		// Reset partial UTF-8: control chars não são parte de runes.
		p.utf8N = 0
		p.h.Execute(c)
		return
	}
	if c < 0x80 {
		p.utf8N = 0
		p.h.Print(rune(c))
		return
	}
	// Multibyte UTF-8: acumula até completar a rune.
	if p.utf8N >= len(p.utf8Buf) {
		p.utf8N = 0
	}
	p.utf8Buf[p.utf8N] = c
	p.utf8N++
	r, size := utf8.DecodeRune(p.utf8Buf[:p.utf8N])
	if r == utf8.RuneError && size == 1 && !utf8.FullRune(p.utf8Buf[:p.utf8N]) {
		// ainda incompleto; espera próximo byte
		return
	}
	p.utf8N = 0
	p.h.Print(r)
}

func (p *Parser) escape(c byte) {
	switch {
	case c == '[':
		p.reset()
		p.st = stCSIParam
	case c == ']':
		p.reset()
		p.st = stOSC
	case c >= 0x20 && c <= 0x2f:
		p.inter = append(p.inter, c)
	case c >= 0x30 && c <= 0x7e:
		p.h.ESC(c, p.inter)
		p.reset()
		p.st = stGround
	default:
		p.reset()
		p.st = stGround
	}
}

func (p *Parser) csiParam(c byte) {
	switch {
	case c >= '0' && c <= '9':
		p.curParam = p.curParam*10 + int(c-'0')
		p.hasParam = true
	case c == ';':
		p.commitParam()
	case c >= 0x20 && c <= 0x2f:
		if p.hasParam || p.curParam != 0 {
			p.commitParam()
		}
		p.inter = append(p.inter, c)
		p.st = stCSIInter
	case c >= 0x40 && c <= 0x7e:
		if p.hasParam || len(p.params) == 0 {
			p.commitParam()
		}
		p.h.CSI(c, p.params, p.inter)
		p.reset()
		p.st = stGround
	}
}

func (p *Parser) csiInter(c byte) {
	switch {
	case c >= 0x20 && c <= 0x2f:
		p.inter = append(p.inter, c)
	case c >= 0x40 && c <= 0x7e:
		p.h.CSI(c, p.params, p.inter)
		p.reset()
		p.st = stGround
	default:
		p.reset()
		p.st = stGround
	}
}

func (p *Parser) oscByte(c byte) {
	// OSC termina em BEL (0x07) ou ST (\x1b\\).
	if c == 0x07 {
		p.h.OSC(p.osc)
		p.reset()
		p.st = stGround
		return
	}
	if c == 0x1b {
		// pode ser ST: olha o próximo byte; aqui simplificamos finalizando
		// imediatamente — ST real vem como \\ logo depois e será ignorado.
		p.h.OSC(p.osc)
		p.reset()
		p.st = stEscape
		return
	}
	if len(p.osc) < 4096 {
		p.osc = append(p.osc, c)
	}
}
