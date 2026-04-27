import { useEffect, useRef } from "react";
import { Terminal as Xterm, type ITerminalOptions } from "@xterm/xterm";
import { call } from "@/rpc/core";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import type { ISearchOptions } from "@xterm/addon-search";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { WebFontsAddon } from "@xterm/addon-web-fonts";
import { SerializeAddon } from "@xterm/addon-serialize";
import "@xterm/xterm/css/xterm.css";

import { Call as $Call } from "@wailsio/runtime";
import { ResizePty, WritePty } from "../../wailsjs/go/main/Terminal";
import { EventsOff, EventsOn } from "../../wailsjs/runtime/runtime";

// Bridge WS pra E/S do terminal — bypassa o transport HTTP-fetch do Wails v3,
// que adiciona dezenas de ms por chamada. Cada keystroke + cada chunk de
// output viaja por uma WebSocket de loopback (~ms), não por fetch.
const TERMINAL_WS_PORT_CACHE = { value: 0, fetched: false };
async function getTerminalPort(): Promise<number> {
  if (TERMINAL_WS_PORT_CACHE.fetched) return TERMINAL_WS_PORT_CACHE.value;
  const port = await ($Call.ByName("main.Terminal.GetTerminalPort") as Promise<number>);
  TERMINAL_WS_PORT_CACHE.value = port;
  TERMINAL_WS_PORT_CACHE.fetched = true;
  return port;
}

export type TerminalHandle = {
  search: (query: string, opts?: ISearchOptions) => void;
  searchNext: (query: string, opts?: ISearchOptions) => void;
  searchPrev: (query: string, opts?: ISearchOptions) => void;
  clear: () => void;
  focus: () => void;
  serialize: () => string;
};

type Props = {
  sessionId: string;
  active?: boolean;
  onCwd?: (cwd: string) => void;
  onTitle?: (title: string) => void;
  onExit?: (code: number) => void;
  onFileLink?: (path: string, line: number, col: number) => void;
  handleRef?: (handle: TerminalHandle | null) => void;
};

// resolveCssColor aplica `var(--name)` num elemento probe e lê o resultado
// computado (sempre rgb/rgba). Isso converte qualquer formato moderno (oklch,
// hsl, color()) pro formato que o renderer WebGL/Canvas do xterm entende.
function resolveCssColor(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.color = `var(${varName})`;
  document.body.appendChild(probe);
  try {
    const resolved = getComputedStyle(probe).color;
    return resolved && resolved !== "rgba(0, 0, 0, 0)" ? resolved : fallback;
  } finally {
    probe.remove();
  }
}

function buildTheme(): ITerminalOptions["theme"] {
  const bg = resolveCssColor("--background", "#18181b");
  const fg = resolveCssColor("--foreground", "#e4e4e7");
  const sel = resolveCssColor("--accent", "#3f3f46");
  const muted = resolveCssColor("--muted-foreground", "#71717a");

  return {
    background: bg,
    foreground: fg,
    cursor: fg,
    cursorAccent: bg,
    selectionBackground: sel,
    selectionInactiveBackground: "#2d2d30",
    black: "#09090b",
    brightBlack: "#52525b",
    red: "#f87171",
    brightRed: "#fca5a5",
    green: "#4ade80",
    brightGreen: "#86efac",
    yellow: "#fbbf24",
    brightYellow: "#fcd34d",
    blue: "#60a5fa",
    brightBlue: "#93c5fd",
    magenta: "#c084fc",
    brightMagenta: "#d8b4fe",
    cyan: "#22d3ee",
    brightCyan: "#67e8f9",
    white: "#e4e4e7",
    brightWhite: "#fafafa",
    // OSC 133 prompt marker color
    overviewRulerBorder: muted,
  };
}

// FILE_LINK_RE detecta padrões como /path/file.ts:12:5 ou ./src/foo.tsx:3
const FILE_LINK_RE = /(?:^|[\s(["'])((\.{0,2}\/[^\s"':,)]+(?:\.[a-zA-Z]{1,6})?):(\d+)(?::(\d+))?)/;

export function Terminal({
  sessionId,
  active = true,
  onCwd,
  onTitle,
  onExit,
  onFileLink,
  handleRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !sessionId) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const start = async () => {
      const [fontFamily, fontSize, cursorStyle, cursorBlink, scrollback] = await Promise.all([
        call<string>("config.get", {
          key: "terminal.fontFamily",
          defaultValue: "'Google Sans Code', monospace",
        }),
        call<number>("config.get", { key: "terminal.fontSize", defaultValue: 13 }),
        call<"block" | "underline" | "bar">("config.get", {
          key: "terminal.cursorStyle",
          defaultValue: "bar",
        }),
        call<boolean>("config.get", { key: "terminal.cursorBlink", defaultValue: true }),
        call<number>("config.get", { key: "terminal.scrollback", defaultValue: 20_000 }),
      ]);
      if (cancelled) return;

      const term = new Xterm({
        fontFamily:
          fontFamily ||
          '"Google Sans Code", "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: typeof fontSize === "number" && fontSize > 0 ? fontSize : 13,
        lineHeight: 1.3,
        cursorBlink: Boolean(cursorBlink),
        cursorStyle: cursorStyle ?? "bar",
        allowProposedApi: true,
        scrollback: typeof scrollback === "number" && scrollback >= 0 ? scrollback : 20_000,
        theme: buildTheme(),
        macOptionIsMeta: true,
      });

      const fit = new FitAddon();
      const search = new SearchAddon();
      const serialize = new SerializeAddon();
      const webFonts = new WebFontsAddon();
      const unicode = new UnicodeGraphemesAddon();

      term.loadAddon(fit);
      term.loadAddon(search);
      term.loadAddon(serialize);
      term.loadAddon(webFonts);
      term.loadAddon(unicode);
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(new ClipboardAddon());
      term.unicode.activeVersion = "15";

      term.open(container);

      // Renderer cascade: WebGL > Canvas > DOM (default).
      // WebGL falha silenciosamente em alguns WebKitGTK; Canvas é compatível
      // e ainda assim ~5x mais rápido que o DOM renderer pra rajadas grandes.
      let rendererAttached = false;
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        term.loadAddon(webgl);
        rendererAttached = true;
      } catch {
        /* fallback abaixo */
      }
      if (!rendererAttached) {
        try {
          term.loadAddon(new CanvasAddon());
          rendererAttached = true;
        } catch {
          /* DOM renderer fica como último recurso */
        }
      }

      // OSC 7 — atualiza cwd
      term.parser.registerOscHandler(7, (data) => {
        try {
          const url = new URL(data);
          onCwd?.(decodeURIComponent(url.pathname));
        } catch {}
        return false;
      });

      // OSC 0 / 2 — título da janela
      const titleHandler = (data: string) => {
        onTitle?.(data);
        return false;
      };
      term.parser.registerOscHandler(0, titleHandler);
      term.parser.registerOscHandler(2, titleHandler);

      // OSC 133 — shell integration markers
      term.parser.registerOscHandler(133, (data) => {
        if (data.startsWith("D;")) {
          const code = parseInt(data.slice(2), 10);
          if (!isNaN(code) && code !== 0) {
            term.registerDecoration({
              marker: term.registerMarker(0)!,
            });
          }
        }
        return false;
      });

      if (onFileLink) {
        term.registerLinkProvider({
          provideLinks(y, callback) {
            const line = term.buffer.active.getLine(y)?.translateToString(true) ?? "";
            const match = FILE_LINK_RE.exec(line);
            if (!match) {
              callback([]);
              return;
            }
            const [full, filePath, lineStr, colStr] = match;
            const lineNum = parseInt(lineStr ?? "1", 10);
            const colNum = parseInt(colStr ?? "1", 10);
            const startX =
              match.index +
              (full.length -
                (filePath?.length ?? 0) -
                (lineStr?.length ?? 0) -
                (colStr?.length ?? 0));
            callback([
              {
                range: {
                  start: { x: Math.max(1, startX), y },
                  end: { x: startX + (full.length - 1), y },
                },
                text: filePath ?? "",
                decorations: { underline: true, pointerCursor: true },
                activate() {
                  onFileLink(filePath ?? "", lineNum, colNum);
                },
              },
            ]);
          },
        });
      }

      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown") return true;
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
          const sel = term.getSelection();
          if (sel) navigator.clipboard.writeText(sel).catch(() => {});
          return false;
        }
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "c") {
          if (term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection()).catch(() => {});
            term.clearSelection();
            return false;
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
          navigator.clipboard
            .readText()
            .then((t) => {
              WritePty(sessionId, t).catch(() => {});
            })
            .catch(() => {});
          return false;
        }
        return true;
      });

      // Fallback via Wails events — só recebe quando o WS bridge não está
      // anexado no backend (transição inicial, ou WS quebrou).
      const unsubData = EventsOn(`pty:data:${sessionId}`, (b64: string) => {
        try {
          const raw = atob(b64);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          term.write(bytes);
        } catch {
          term.write(b64);
        }
      });

      const unsubExit = EventsOn(`pty:exit:${sessionId}`, (code: number) => {
        term.writeln(`\r\n\x1b[90m[processo encerrado · exit ${code}]\x1b[0m`);
        onExit?.(code);
      });

      // ── WebSocket bridge ──────────────────────────────────────────────────
      // Conecta em paralelo. Enquanto não abrir, term.onData cai no WritePty
      // (slow path). Quando abrir, vira o caminho primário pros dois sentidos.
      // Usa ref-object pra manter o tipo estável (TS faz narrowing agressivo
      // de `let x: WebSocket | null` quando há reatribuições em closures).
      const wsRef: { current: WebSocket | null } = { current: null };
      const encoder = new TextEncoder();

      void (async () => {
        try {
          const port = await getTerminalPort();
          if (cancelled || !port) return;
          const conn = new WebSocket(`ws://127.0.0.1:${port}/term/${sessionId}`);
          conn.binaryType = "arraybuffer";
          conn.onmessage = (e) => {
            if (e.data instanceof ArrayBuffer) {
              term.write(new Uint8Array(e.data));
            } else if (typeof e.data === "string") {
              term.write(e.data);
            }
          };
          conn.onerror = () => {
            wsRef.current = null;
          };
          conn.onclose = () => {
            wsRef.current = null;
          };
          wsRef.current = conn;
        } catch {
          wsRef.current = null;
        }
      })();

      term.onData((data) => {
        const conn = wsRef.current;
        if (conn && conn.readyState === WebSocket.OPEN) {
          conn.send(encoder.encode(data));
        } else {
          WritePty(sessionId, data).catch(() => {});
        }
      });

      const resizeObs = new ResizeObserver(() => {
        try {
          fit.fit();
          ResizePty(sessionId, term.cols, term.rows).catch(() => {});
        } catch {}
      });
      resizeObs.observe(container);

      handleRef?.({
        search: (q, o) => search.findNext(q, o),
        searchNext: (q, o) => search.findNext(q, o),
        searchPrev: (q, o) => search.findPrevious(q, o),
        clear: () => term.clear(),
        focus: () => term.focus(),
        serialize: () => serialize.serialize(),
      });

      // Carrega fontes em paralelo — não bloqueia o fit/focus inicial.
      void webFonts.loadFonts().catch(() => {});
      if (cancelled) {
        resizeObs.disconnect();
        unsubData?.();
        unsubExit?.();
        EventsOff(`pty:data:${sessionId}`, `pty:exit:${sessionId}`);
        try {
          wsRef.current?.close();
        } catch {
          /* ignore */
        }
        handleRef?.(null);
        term.dispose();
        return;
      }
      fit.fit();
      ResizePty(sessionId, term.cols, term.rows).catch(() => {});
      if (active) term.focus();

      cleanup = () => {
        resizeObs.disconnect();
        unsubData?.();
        unsubExit?.();
        EventsOff(`pty:data:${sessionId}`, `pty:exit:${sessionId}`);
        try {
          wsRef.current?.close();
        } catch {
          /* ignore */
        }
        handleRef?.(null);
        term.dispose();
      };
    };

    void start();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [sessionId]);

  // foca quando aba se torna ativa
  useEffect(() => {
    if (active && containerRef.current) {
      containerRef.current.querySelector<HTMLElement>(".xterm-helper-textarea")?.focus();
    }
  }, [active]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export default Terminal;
