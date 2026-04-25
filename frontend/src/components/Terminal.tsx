import { useEffect, useRef } from "react";
import { Terminal as Xterm, type ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import type { ISearchOptions } from "@xterm/addon-search";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { UnicodeGraphemesAddon } from "@xterm/addon-unicode-graphemes";
import { WebFontsAddon } from "@xterm/addon-web-fonts";
import { SerializeAddon } from "@xterm/addon-serialize";
import "@xterm/xterm/css/xterm.css";

import { ResizePty, WritePty } from "../../wailsjs/go/main/Terminal";
import { EventsOff, EventsOn } from "../../wailsjs/runtime/runtime";

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

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function buildTheme(): ITerminalOptions["theme"] {
  const bg = getCssVar("--background") || "#18181b";
  const fg = getCssVar("--foreground") || "#e4e4e7";
  const sel = getCssVar("--accent") || "#3f3f46";
  const muted = getCssVar("--muted-foreground") || "#71717a";

  return {
    background: bg.startsWith("oklch") ? "#18181b" : bg,
    foreground: fg.startsWith("oklch") ? "#e4e4e7" : fg,
    cursor: fg.startsWith("oklch") ? "#e4e4e7" : fg,
    cursorAccent: bg.startsWith("oklch") ? "#18181b" : bg,
    selectionBackground: sel.startsWith("oklch") ? "#3f3f46" : sel,
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
    overviewRulerBorder: muted.startsWith("oklch") ? "#52525b" : muted,
  };
}

// FILE_LINK_RE detecta padrões como /path/file.ts:12:5 ou ./src/foo.tsx:3
const FILE_LINK_RE =
  /(?:^|[\s(["'])((\.{0,2}\/[^\s"':,)]+(?:\.[a-zA-Z]{1,6})?):(\d+)(?::(\d+))?)/;

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

    const term = new Xterm({
      fontFamily:
        '"Google Sans Code", "JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "bar",
      allowProposedApi: true,
      scrollback: 20_000,
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

    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch {
      // fallback to DOM renderer
    }

    // --- OSC parsers ---

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

    // OSC 133 — shell integration markers (A=prompt start, D=cmd end)
    term.parser.registerOscHandler(133, (data) => {
      if (data.startsWith("D;")) {
        const code = parseInt(data.slice(2), 10);
        if (!isNaN(code) && code !== 0) {
          // adiciona ruler pra marcar linha com erro
          term.registerDecoration({
            marker: term.registerMarker(0)!,
          });
        }
      }
      return false;
    });

    // --- Link provider: file.ts:12:5 ---
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
          const startX = match.index + (full.length - (filePath?.length ?? 0) - (lineStr?.length ?? 0) - (colStr?.length ?? 0));
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

    // --- Input: Ctrl+C copia se há seleção, senão envia SIGINT ---
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;

      // Ctrl+Shift+C → copiar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        const sel = term.getSelection();
        if (sel) navigator.clipboard.writeText(sel).catch(() => {});
        return false;
      }

      // Ctrl+C com seleção → copia em vez de SIGINT
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "c") {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          term.clearSelection();
          return false;
        }
      }

      // Ctrl+Shift+V → colar
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        navigator.clipboard.readText().then((t) => {
          WritePty(sessionId, t).catch(() => {});
        }).catch(() => {});
        return false;
      }

      return true;
    });

    // --- Saída do PTY → xterm (dados em base64) ---
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

    // --- Input do xterm → PTY ---
    term.onData((data) => {
      WritePty(sessionId, data).catch(() => {});
    });

    // --- Resize ---
    const resizeObs = new ResizeObserver(() => {
      try {
        fit.fit();
        ResizePty(sessionId, term.cols, term.rows).catch(() => {});
      } catch {}
    });
    resizeObs.observe(container);

    // --- Handle exposto ao pai ---
    handleRef?.({
      search: (q, o) => search.findNext(q, o),
      searchNext: (q, o) => search.findNext(q, o),
      searchPrev: (q, o) => search.findPrevious(q, o),
      clear: () => term.clear(),
      focus: () => term.focus(),
      serialize: () => serialize.serialize(),
    });

    const init = async () => {
      try { await webFonts.loadFonts(); } catch {}
      fit.fit();
      ResizePty(sessionId, term.cols, term.rows).catch(() => {});
      if (active) term.focus();
    };
    void init();

    return () => {
      resizeObs.disconnect();
      unsubData?.();
      unsubExit?.();
      EventsOff(`pty:data:${sessionId}`, `pty:exit:${sessionId}`);
      handleRef?.(null);
      term.dispose();
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
