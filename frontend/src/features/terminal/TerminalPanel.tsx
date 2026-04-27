import type { ISearchOptions } from "@xterm/addon-search";
import { ChevronDown, ChevronUp, Plus, Search, X, XCircle } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ListShells, WritePty } from "../../../wailsjs/go/main/Terminal";
import type { TerminalHandle } from "../../components/Terminal";
import { Checkbox } from "../../components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useTerminals } from "./store";

type ShellInfo = { path: string; name: string; avail: boolean };

const Terminal = lazy(() =>
  import("../../components/Terminal").then((m) => ({ default: m.Terminal })),
);

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 280;
const MAX_HEIGHT = 700;

type SearchState = {
  open: boolean;
  query: string;
  caseSensitive: boolean;
  regex: boolean;
};

type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  sessionId: string;
};

type TerminalPanelProps = {
  defaultCwd?: string;
  onFileLink?: (path: string, line: number, col: number) => void;
  onClose?: () => void;
};

export function TerminalPanel({ defaultCwd, onFileLink, onClose }: TerminalPanelProps) {
  const { sessions, activeId, create, close, focus, updateSession } = useTerminals();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [search, setSearch] = useState<SearchState>({
    open: false,
    query: "",
    caseSensitive: false,
    regex: false,
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    sessionId: "",
  });

  const [shells, setShells] = useState<ShellInfo[]>([]);

  useEffect(() => {
    ListShells()
      .then((list) => setShells((list ?? []).filter((s: ShellInfo) => s.avail)))
      .catch(() => {});
  }, []);

  const handlesRef = useRef<Map<string, TerminalHandle>>(new Map());
  const isDragging = useRef(false);
  const dragStart = useRef({ y: 0, height: 0 });

  // inicia com uma sessão se não houver nenhuma.
  // Guard via ref pra evitar a corrida do StrictMode em dev: o efeito
  // dispara duas vezes, e como `create` é async, `sessions.length` ainda é
  // 0 na segunda passada — sem o guard nasceria um terminal duplicado.
  const initStartedRef = useRef(false);
  useEffect(() => {
    if (initStartedRef.current) return;
    if (sessions.length > 0) return;
    initStartedRef.current = true;
    create({ cwd: defaultCwd }).catch(() => {
      initStartedRef.current = false;
    });
  }, []);

  const newTab = useCallback(
    (shell = "") => {
      create({ cwd: defaultCwd, shell }).catch(() => {});
    },
    [create, defaultCwd],
  );

  // --- Resize por drag ---
  const onDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { y: e.clientY, height };
    e.preventDefault();
  };

  useEffect(() => {
    let rafId = 0;
    let pendingY = 0;
    const flush = () => {
      rafId = 0;
      const delta = dragStart.current.y - pendingY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragStart.current.height + delta));
      setHeight(next);
    };
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      pendingY = e.clientY;
      if (rafId === 0) rafId = requestAnimationFrame(flush);
    };
    const onUp = () => {
      isDragging.current = false;
      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (rafId !== 0) cancelAnimationFrame(rafId);
    };
  }, []);

  // --- Search ---
  const activeHandle = activeId ? handlesRef.current.get(activeId) : null;

  const searchOpts = (): ISearchOptions => ({
    caseSensitive: search.caseSensitive,
    regex: search.regex,
    decorations: {
      matchBackground: "#fbbf2440",
      matchBorder: "#fbbf24",
      matchOverviewRuler: "#fbbf24",
      activeMatchBackground: "#fbbf2480",
      activeMatchBorder: "#fbbf24",
      activeMatchColorOverviewRuler: "#fbbf24",
    },
  });

  const doSearch = (q: string) => activeHandle?.searchNext(q, searchOpts());
  const doPrev = () => activeHandle?.searchPrev(search.query, searchOpts());

  useEffect(() => {
    if (search.query) doSearch(search.query);
  }, [search.query, search.caseSensitive, search.regex]);

  // Ctrl+Shift+F abre busca
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearch((s) => ({ ...s, open: !s.open }));
      }
      if (e.key === "Escape" && search.open) {
        setSearch((s) => ({ ...s, open: false }));
        activeHandle?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [search.open, activeHandle]);

  // --- Context menu ---
  const openContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, sessionId });
  };

  useEffect(() => {
    if (!contextMenu.open) return;
    const close = () => setContextMenu((m) => ({ ...m, open: false }));
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu.open]);

  const ctxHandle = contextMenu.sessionId ? handlesRef.current.get(contextMenu.sessionId) : null;

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex flex-col border-t bg-background shrink-0 relative" style={{ height }}>
      {/* drag handle */}
      <div
        className="absolute inset-x-0 top-0 h-1 cursor-ns-resize hover:bg-primary/30 transition-colors z-10"
        onMouseDown={onDragStart}
      />

      {/* tab bar */}
      <div className="flex items-center border-b bg-muted/30 shrink-0 overflow-hidden">
        <div className="flex items-center flex-1 overflow-x-auto min-w-0">
          {sessions.map((s) => (
            <button
              key={s.id}
              onContextMenu={(e) => openContextMenu(e, s.id)}
              onClick={() => focus(s.id)}
              className={
                "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r shrink-0 select-none " +
                (s.id === activeId
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground")
              }
            >
              <span className="truncate max-w-40">{s.title}</span>
              {!s.running && <XCircle className="size-3 text-destructive shrink-0" />}
              <span
                role="button"
                aria-label="Fechar"
                onClick={(e) => {
                  e.stopPropagation();
                  close(s.id);
                }}
                className="opacity-50 hover:opacity-100 shrink-0"
              >
                <X className="size-3" />
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 px-2 shrink-0">
          <button
            onClick={() => setSearch((s) => ({ ...s, open: !s.open }))}
            className="p-1 rounded hover:bg-accent opacity-70 hover:opacity-100"
            title="Buscar no terminal (Ctrl+Shift+F)"
          >
            <Search className="size-3.5" />
          </button>
          {/* Dropdown shadcn: usa Radix Popper com collision detection,
              então nunca fica escondido por borda da WebView. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded hover:bg-accent opacity-70 hover:opacity-100 cursor-pointer"
                title="Novo terminal"
                aria-label="Novo terminal"
              >
                <Plus className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Novo terminal
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => newTab("")}>Shell padrão</DropdownMenuItem>
              {shells.length > 0 && <DropdownMenuSeparator />}
              {shells.map((s) => (
                <DropdownMenuItem key={s.path} onSelect={() => newTab(s.path)}>
                  <span className="flex flex-col gap-0">
                    <span>{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{s.path}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent opacity-70 hover:opacity-100"
            title="Fechar painel"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* search bar */}
      {search.open && (
        <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/20 text-xs shrink-0">
          <Search className="size-3 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={search.query}
            onChange={(e) => setSearch((s) => ({ ...s, query: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.shiftKey) {
                  doPrev();
                } else {
                  doSearch(search.query);
                }
              }
              if (e.key === "Escape") setSearch((s) => ({ ...s, open: false }));
            }}
            placeholder="Buscar no terminal..."
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <Checkbox
              checked={search.caseSensitive}
              onCheckedChange={(v) => setSearch((s) => ({ ...s, caseSensitive: v }))}
              aria-label="Case sensitive"
            />
            Aa
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none">
            <Checkbox
              checked={search.regex}
              onCheckedChange={(v) => setSearch((s) => ({ ...s, regex: v }))}
              aria-label="Regex"
            />
            .*
          </label>
          <button onClick={doPrev} className="opacity-70 hover:opacity-100">
            <ChevronUp className="size-3.5" />
          </button>
          <button onClick={() => doSearch(search.query)} className="opacity-70 hover:opacity-100">
            <ChevronDown className="size-3.5" />
          </button>
          <button
            onClick={() => setSearch((s) => ({ ...s, open: false }))}
            className="opacity-70 hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* terminal instances */}
      <div className="flex-1 relative overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Carregando terminal…
            </div>
          }
        >
          {sessions.map((s) => (
            <div
              key={s.id}
              className="absolute inset-0"
              style={{ visibility: s.id === activeId ? "visible" : "hidden" }}
              onContextMenu={(e) => openContextMenu(e, s.id)}
            >
              <Terminal
                sessionId={s.id}
                active={s.id === activeId}
                onCwd={(cwd) => updateSession(s.id, { cwd })}
                onTitle={(title) => updateSession(s.id, { title })}
                onExit={(code) => updateSession(s.id, { running: false, exitCode: code })}
                onFileLink={onFileLink}
                handleRef={(h) => {
                  if (h) handlesRef.current.set(s.id, h);
                  else handlesRef.current.delete(s.id);
                }}
              />
            </div>
          ))}
        </Suspense>
      </div>

      {/* context menu */}
      {contextMenu.open && (
        <div
          className="fixed z-50 bg-popover border rounded-md shadow-md py-1 text-xs min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {[
            {
              label: "Copiar",
              action: () => {
                const sel = window.getSelection()?.toString();
                if (sel) navigator.clipboard.writeText(sel).catch(() => {});
              },
            },
            {
              label: "Colar",
              action: () => {
                navigator.clipboard
                  .readText()
                  .then((t) => {
                    WritePty(contextMenu.sessionId, t).catch(() => {});
                  })
                  .catch(() => {});
              },
            },
            {
              label: "Limpar",
              action: () => ctxHandle?.clear(),
            },
            {
              label: "Fechar aba",
              action: () => close(contextMenu.sessionId),
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
