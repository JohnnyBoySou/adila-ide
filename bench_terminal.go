package main

import (
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/websocket"
)

// bench_terminal.go — endpoints isolados para medir latência de I/O do
// terminal por caminho de transporte. Existem para responder à pergunta:
// "fetch via Wails RPC realmente custa 50-700ms no WebKitGTK, ou esse era
// um sintoma de outra coisa?". Comparar 3 paths:
//
//   1. Wails RPC echo (BenchEchoFetch)         — fetch de ida-e-volta puro
//   2. Wails RPC -> Event (BenchEchoViaEvents) — fetch de ida + event de volta
//   3. WebSocket echo (handleBenchEchoWS)      — WS bidirecional binário
//
// Os métodos exportados são bindados via Wails v3 service no mesmo Terminal,
// então as bindings TS aparecem em wailsjs/go/main/Terminal.

// BenchEchoFetch devolve o payload sem tocar em nada. Mede o overhead do
// caminho fetch do Wails RPC ponta-a-ponta (frontend -> WebKitGTK fetch ->
// Go handler -> JSON encode -> volta).
func (t *Terminal) BenchEchoFetch(payload string) string {
	return payload
}

// BenchEchoViaEvents recebe via fetch (RPC) e devolve via runtime event
// "bench:io:" + correlationId. O frontend mede de "antes do fetch" até
// "evento recebido" pra capturar fetch_in + event_out (half-duplex).
func (t *Terminal) BenchEchoViaEvents(correlationID string, payload string) {
	emit("bench:io:"+correlationID, payload)
}

// handleBenchEchoWS faz upgrade pra WebSocket e ecoa cada mensagem recebida.
// Registrado em /bench/echo no mesmo http.Server do bridge de PTY (mesma
// porta retornada por GetTerminalPort).
func (t *Terminal) handleBenchEchoWS(w http.ResponseWriter, r *http.Request) {
	ws, err := t.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer ws.Close()
	for {
		mt, msg, err := ws.ReadMessage()
		if err != nil {
			return
		}
		if err := ws.WriteMessage(mt, msg); err != nil {
			return
		}
	}
}

// BenchSaveResult persiste um JSON do resultado do bench em disco para
// permitir que o /loop leia os números sem depender de copy-paste manual
// do devtools. Salva em <cwd>/benchmarks/terminal_io_<ts>.json e devolve
// o caminho absoluto.
func (t *Terminal) BenchSaveResult(jsonPayload string) (string, error) {
	dir := filepath.Join(".", "benchmarks")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	name := "terminal_io_" + time.Now().UTC().Format("20060102T150405") + ".json"
	full := filepath.Join(dir, name)
	if err := os.WriteFile(full, []byte(jsonPayload), 0o644); err != nil {
		return "", err
	}
	abs, err := filepath.Abs(full)
	if err != nil {
		return full, nil
	}
	return abs, nil
}

// silenceUnused garante que websocket fique referenciado caso algum dos
// métodos suma — não é usado em runtime.
var _ = websocket.BinaryMessage
