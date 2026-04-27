# adila-term

Terminal nativo Gio para o Adila IDE. Substitui o terminal baseado em xterm.js
quando a latência via WebView (Wails / WebKitGTK) ficar inaceitável.

## Por que existe

O caminho atual `keystroke → xterm.js onData → Wails fetch → Go pty.Write`
custa 50-700ms por tecla no WebKitGTK Linux porque toda chamada vira um
HTTP fetch interno. Aqui não tem WebView: keystroke é uma chamada de função
em-processo até o `pty.Write`, e o output volta direto pro renderer Gio.

Latência alvo: **1 frame (~16ms)** ponta-a-ponta.

## Stack

- **GUI:** [Gio](https://gioui.org) — immediate-mode, GPU-accelerated
  (Vulkan/Metal/D3D11/GL), build estático cross-platform
- **PTY:** `github.com/aymanbagabas/go-pty` — Linux, macOS, Windows (ConPTY)
- **VT/ANSI parser:** `vt/parser.go` — state machine própria, ground/escape/CSI/OSC
- **Screen state:** `vt/screen.go` — grade de cells + scrollback ring + cursor
- **Input:** `vt/input.go` — tabela `key.Event → escape sequence`
- **Render:** `main.go` (MVP via material.Label); `render/grid.go` é o draft
  do renderer otimizado com per-cell colors.

## Build

```bash
cd cmd/term
go mod tidy
go build .
./adila-term            # usa $SHELL
./adila-term /bin/bash  # shell explícito
```

Builds cross-platform via padrão Go:

```bash
GOOS=linux   GOARCH=amd64 go build -o adila-term-linux  .
GOOS=windows GOARCH=amd64 go build -o adila-term.exe    .
GOOS=darwin  GOARCH=arm64 go build -o adila-term-mac    .
```

## Estado atual (MVP)

Funciona:
- Spawnar shell e ver output (sem cores, monoespaçado)
- Digitar — letras, Enter, setas, Ctrl+C/D/Z, Tab, Backspace
- Cursor visível como block sólido
- Scroll automático quando output ultrapassa as linhas

Falta (em ordem de prioridade):
- [ ] Renderer com FG/BG por célula (atlas de glyphs em GPU)
- [ ] Resize do PTY conforme janela
- [ ] Selection + copy/paste com clipboard
- [ ] Mouse (click, scroll wheel, drag selection)
- [ ] OSC 8 hyperlinks + OSC 7 cwd tracking
- [ ] Fontes configuráveis + ligatures
- [ ] Bracketed paste mode
- [ ] Alt screen buffer (vim/less)
- [ ] Sixel/Kitty graphics

## Integração com o IDE

Curto prazo: roda como processo separado (binário) lançado pelo IDE,
substituindo o painel xterm.js. Comunicação opcional via socket pra
sincronizar cwd/branches/etc.

Médio prazo: portar a IDE inteira pra Gio quando o terminal estiver
maduro — daí tudo vira nativo.
