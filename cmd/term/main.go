// cmd/term — terminal nativo Gio com PTY local.
//
// MVP do terminal nativo do Adila IDE. Foco: latência mínima de input.
// Sem WebView, sem IPC HTTP — keystroke → pty.Write é uma chamada de função
// na mesma goroutine de UI. Esperado: < 20ms ponta-a-ponta (basicamente
// 1 frame), vs 700ms+ no caminho via Wails fetch.
//
// Build:
//
//	cd cmd/term && go mod tidy && go build .
//
// Roda:
//
//	./term            # usa $SHELL
//	./term /bin/bash  # shell explícito
//
// Cross-platform: Linux (X11/Wayland), Windows, macOS via Gio.
package main

import (
	"context"
	"flag"
	"fmt"
	"image"
	"image/color"
	"log"
	"os"
	"runtime"

	"gioui.org/app"
	"gioui.org/font"
	"gioui.org/font/gofont"
	"gioui.org/io/event"
	"gioui.org/io/key"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/text"
	"gioui.org/unit"
	"gioui.org/widget/material"

	xpty "github.com/aymanbagabas/go-pty"

	"adila-term/vt"
)

const (
	defaultCols = 100
	defaultRows = 30
	defaultFont = unit.Sp(13)
)

func main() {
	flag.Parse()

	go func() {
		if err := run(flag.Arg(0)); err != nil {
			log.Fatal(err)
		}
		os.Exit(0)
	}()
	app.Main()
}

func run(shellArg string) error {
	// ── PTY ─────────────────────────────────────────────────────────────
	pty, err := xpty.New()
	if err != nil {
		return fmt.Errorf("pty new: %w", err)
	}
	defer pty.Close()

	shell := shellArg
	if shell == "" {
		shell = os.Getenv("SHELL")
	}
	if shell == "" {
		if runtime.GOOS == "windows" {
			shell = "powershell.exe"
		} else {
			shell = "/bin/bash"
		}
	}

	cmd := pty.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", "COLORTERM=truecolor")
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", shell, err)
	}

	if err := pty.Resize(defaultCols, defaultRows); err != nil {
		log.Printf("resize inicial falhou: %v", err)
	}

	// ── Screen + parser ─────────────────────────────────────────────────
	screen := vt.NewScreen(defaultCols, defaultRows)
	parser := vt.New(screen)

	// ── Window ──────────────────────────────────────────────────────────
	w := new(app.Window)
	w.Option(
		app.Title("Adila Term"),
		app.Size(unit.Dp(900), unit.Dp(560)),
	)
	screen.SetOnDirty(func() { w.Invalidate() })

	// PTY → parser, em goroutine separada. Cada Read é direto pro screen.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go pumpPTY(ctx, pty, parser)

	// ── UI loop ─────────────────────────────────────────────────────────
	th := material.NewTheme()
	th.Shaper = text.NewShaper(text.WithCollection(gofont.Collection()))

	var (
		ops      op.Ops
		focusTag = new(int) // identidade pra captura de foco
	)

	for {
		switch e := w.Event().(type) {
		case app.DestroyEvent:
			cancel()
			_ = cmd.Process.Kill()
			return e.Err

		case app.FrameEvent:
			gtx := app.NewContext(&ops, e)

			// captura de teclado.
			event.Op(gtx.Ops, focusTag)
			handleKeys(gtx, focusTag, pty)

			// pinta fundo escuro.
			paintRect(gtx.Ops,
				color.NRGBA{R: 0x09, G: 0x09, B: 0x0b, A: 0xff},
				gtx.Constraints.Max.X, gtx.Constraints.Max.Y)

			// renderiza screen → string monoespaçada.
			cells, cols, rows, _, _, _ := screen.Snapshot()
			body := snapshotToString(cells, cols, rows)
			lbl := material.Label(th, defaultFont, body)
			lbl.Color = color.NRGBA{R: 0xe4, G: 0xe4, B: 0xe7, A: 0xff}
			lbl.Font = font.Font{Typeface: "Go Mono"}
			lbl.MaxLines = rows
			layout.Inset{Top: unit.Dp(4), Left: unit.Dp(8)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return lbl.Layout(gtx)
			})

			// pede foco se não temos ainda.
			gtx.Execute(key.FocusCmd{Tag: focusTag})

			e.Frame(gtx.Ops)
		}
	}
}

func pumpPTY(ctx context.Context, pty xpty.Pty, parser *vt.Parser) {
	buf := make([]byte, 32*1024)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		n, err := pty.Read(buf)
		if n > 0 {
			parser.Write(buf[:n])
		}
		if err != nil {
			return
		}
	}
}

// handleKeys consome eventos de tecla pendentes e os envia ao PTY.
func handleKeys(gtx layout.Context, tag any, pty xpty.Pty) {
	for {
		ev, ok := gtx.Event(
			key.FocusFilter{Target: tag},
			// catch-all: nome vazio = qualquer tecla.
			key.Filter{Focus: tag},
		)
		if !ok {
			break
		}
		switch e := ev.(type) {
		case key.Event:
			if e.State != key.Press {
				continue
			}
			mods := vt.Mods{
				Ctrl:  e.Modifiers.Contain(key.ModCtrl),
				Alt:   e.Modifiers.Contain(key.ModAlt),
				Shift: e.Modifiers.Contain(key.ModShift),
				Meta:  e.Modifiers.Contain(key.ModSuper),
			}
			var asciiR rune
			if len(e.Name) == 1 {
				asciiR = rune(e.Name[0])
				if asciiR >= 'A' && asciiR <= 'Z' && !mods.Shift {
					asciiR = asciiR - 'A' + 'a'
				}
			}
			seq := vt.KeySeq(string(e.Name), mods, asciiR)
			if len(seq) > 0 {
				_, _ = pty.Write(seq)
			}
		case key.EditEvent:
			// Texto digitado (lida com IME e dead keys corretamente).
			if e.Text != "" {
				_, _ = pty.Write([]byte(e.Text))
			}
		}
	}
}

func paintRect(ops *op.Ops, c color.NRGBA, w, h int) {
	defer clip.Rect{Max: image.Point{X: w, Y: h}}.Push(ops).Pop()
	paint.ColorOp{Color: c}.Add(ops)
	paint.PaintOp{}.Add(ops)
}

// snapshotToString materializa a grade num bloco multi-linha. Solução
// temporária do MVP — não preserva FG/BG por célula. Substituir pelo
// render/grid.go quando o atlas estiver pronto.
func snapshotToString(cells []vt.Cell, cols, rows int) string {
	out := make([]rune, 0, (cols+1)*rows)
	for y := 0; y < rows; y++ {
		for x := 0; x < cols; x++ {
			r := cells[y*cols+x].R
			if r == 0 {
				r = ' '
			}
			out = append(out, r)
		}
		if y < rows-1 {
			out = append(out, '\n')
		}
	}
	return string(out)
}

