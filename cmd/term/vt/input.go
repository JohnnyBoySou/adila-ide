package vt

// KeyCodes converte uma tecla "lógica" pra sequência de bytes que o
// shell espera. Aqui mantemos um subset suficiente pra fish/bash/zsh.
//
// Modifiers seguem a convenção CSI ~: shift=2, alt=3, ctrl=5, etc.
// Pra simplificar o MVP, modifier composto vira escape SS3 ou CSI sem
// parametrização — basta o que cobre 95% do uso.

type Mods struct {
	Ctrl  bool
	Alt   bool
	Shift bool
	Meta  bool
}

func KeySeq(name string, mods Mods, ascii rune) []byte {
	// Ctrl+letra → C0 control (^A=0x01, ..., ^Z=0x1a)
	if mods.Ctrl && !mods.Alt && len(name) == 1 {
		c := name[0]
		if c >= 'A' && c <= 'Z' {
			return []byte{c - 'A' + 1}
		}
		if c >= 'a' && c <= 'z' {
			return []byte{c - 'a' + 1}
		}
		switch c {
		case ' ':
			return []byte{0x00}
		case '[':
			return []byte{0x1b}
		case '\\':
			return []byte{0x1c}
		case ']':
			return []byte{0x1d}
		}
	}

	switch name {
	case "Return", "↵":
		return []byte{'\r'}
	case "Tab":
		if mods.Shift {
			return []byte("\x1b[Z")
		}
		return []byte{'\t'}
	case "Escape":
		return []byte{0x1b}
	case "Backspace", "⌫":
		return []byte{0x7f}
	case "Space":
		return []byte{' '}
	case "↑":
		return arrow('A', mods)
	case "↓":
		return arrow('B', mods)
	case "→":
		return arrow('C', mods)
	case "←":
		return arrow('D', mods)
	case "Home":
		return []byte("\x1b[H")
	case "End":
		return []byte("\x1b[F")
	case "PageUp", "⇞":
		return []byte("\x1b[5~")
	case "PageDown", "⇟":
		return []byte("\x1b[6~")
	case "Insert":
		return []byte("\x1b[2~")
	case "Delete", "⌦":
		return []byte("\x1b[3~")
	case "F1":
		return []byte("\x1bOP")
	case "F2":
		return []byte("\x1bOQ")
	case "F3":
		return []byte("\x1bOR")
	case "F4":
		return []byte("\x1bOS")
	case "F5":
		return []byte("\x1b[15~")
	case "F6":
		return []byte("\x1b[17~")
	case "F7":
		return []byte("\x1b[18~")
	case "F8":
		return []byte("\x1b[19~")
	case "F9":
		return []byte("\x1b[20~")
	case "F10":
		return []byte("\x1b[21~")
	case "F11":
		return []byte("\x1b[23~")
	case "F12":
		return []byte("\x1b[24~")
	}

	// Alt+char → ESC + char
	if mods.Alt && ascii != 0 {
		return []byte{0x1b, byte(ascii)}
	}

	// Texto regular: usa o rune fornecido pelo evento de edição
	if ascii != 0 {
		buf := make([]byte, 0, 4)
		// codifica como UTF-8
		switch {
		case ascii < 0x80:
			buf = append(buf, byte(ascii))
		case ascii < 0x800:
			buf = append(buf, 0xc0|byte(ascii>>6))
			buf = append(buf, 0x80|byte(ascii&0x3f))
		case ascii < 0x10000:
			buf = append(buf, 0xe0|byte(ascii>>12))
			buf = append(buf, 0x80|byte((ascii>>6)&0x3f))
			buf = append(buf, 0x80|byte(ascii&0x3f))
		default:
			buf = append(buf, 0xf0|byte(ascii>>18))
			buf = append(buf, 0x80|byte((ascii>>12)&0x3f))
			buf = append(buf, 0x80|byte((ascii>>6)&0x3f))
			buf = append(buf, 0x80|byte(ascii&0x3f))
		}
		return buf
	}

	return nil
}

func arrow(letter byte, mods Mods) []byte {
	if mods.Ctrl || mods.Alt || mods.Shift {
		// CSI 1 ; m letter — m = 1 + (shift?1:0) + (alt?2:0) + (ctrl?4:0)
		m := byte('1')
		bits := 0
		if mods.Shift {
			bits |= 1
		}
		if mods.Alt {
			bits |= 2
		}
		if mods.Ctrl {
			bits |= 4
		}
		m = byte('1' + bits)
		return []byte{0x1b, '[', '1', ';', m, letter}
	}
	return []byte{0x1b, '[', letter}
}
