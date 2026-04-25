import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  ChevronRight,
  Circle,
  Code2,
  File as FileIcon,
  HelpCircle,
  Hash,
  Package,
  Search,
  Box,
  ArrowDownUp,
  CornerDownLeft,
  CircleSlash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rpc, type FileEntry } from "../rpc";
import { useFilesStore } from "../stores/files";
import type { Mode, PaletteItem } from "../types";

interface PaletteProps {
  initialQuery: string;
  onClose: () => void;
}

interface ParsedQuery {
  mode: Mode;
  search: string;
  rawPrefix: string;
}

const PREFIX_DEBOUNCE_MS: Record<Mode, number> = {
  commands: 0,
  files: 0,
  symbols: 200,
  gotoLine: 0,
  help: 0,
};

const FILES_MAX_RESULTS = 128;

const MODE_LABEL: Record<Mode, string> = {
  commands: "Comandos",
  files: "Arquivos",
  symbols: "Símbolos",
  gotoLine: "Ir para linha",
  help: "Ajuda",
};

const MODE_PLACEHOLDER: Record<Mode, string> = {
  commands: "Digite para filtrar comandos...",
  files: "Digite para buscar arquivos...",
  symbols: "Digite para buscar símbolos...",
  gotoLine: "Ex.: 42  ou  42:10",
  help: "Escolha um prefixo...",
};

export function Palette({ initialQuery, onClose }: PaletteProps) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<PaletteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Files mode reads directly from the zustand cache — no per-keystroke RPC.
  const filesCache = useFilesStore((s) => s.files);
  const filesRoots = useFilesStore((s) => s.roots);
  const filesStatus = useFilesStore((s) => s.status);
  const ensureFilesLoaded = useFilesStore((s) => s.ensureLoaded);

  const parsed = useMemo(() => parseQuery(query), [query]);

  // Focus the input on mount and whenever we reset after an initial prefix.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    el.focus();
    // Move caret to the end so the user types after the prefix.
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [initialQuery]);

  // Reset the query whenever we reopen with a different prefix.
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Kick off the files walk as soon as the palette is open. ensureLoaded
  // is idempotent so mounting in any mode still warms the cache.
  useEffect(() => {
    void ensureFilesLoaded();
  }, [ensureFilesLoaded]);

  // Fetch results per mode/search. Files mode is served entirely from the
  // zustand cache below, so we skip the RPC here. Symbol mode is debounced
  // to avoid hammering workspace symbol providers on every keystroke.
  useEffect(() => {
    const { mode, search } = parsed;
    if (mode === "gotoLine" || mode === "files") {
      setItems([]);
      setLoading(false);
      setSelected(0);
      return;
    }
    const delay = PREFIX_DEBOUNCE_MS[mode];
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      rpc
        .list(mode, search)
        .then((result) => {
          if (!cancelled) {
            setItems(result);
            setSelected(0);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setItems([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [parsed]);

  const filesItems = useMemo(() => {
    if (parsed.mode !== "files") {
      return [];
    }
    return filterFiles(filesCache, filesRoots, parsed.search);
  }, [filesCache, filesRoots, parsed]);

  // Keep selection within bounds as the files list changes.
  useEffect(() => {
    if (parsed.mode === "files") {
      setSelected(0);
    }
  }, [parsed.mode, parsed.search, filesItems.length]);

  const filtered = useMemo(() => {
    if (parsed.mode === "files") {
      return filesItems;
    }
    // For commands mode the host returns the full enabled list; filter here.
    // Other modes already narrow on the host side.
    if (parsed.mode !== "commands" || !parsed.search) {
      return items;
    }
    const q = parsed.search.toLowerCase();
    return items.filter((item) =>
      `${item.title} ${item.description ?? ""}`.toLowerCase().includes(q),
    );
  }, [filesItems, items, parsed]);

  const filesLoading = parsed.mode === "files" && filesStatus === "loading";

  const activate = useCallback(
    (index: number) => {
      if (parsed.mode === "gotoLine") {
        const target = parseGotoLine(parsed.search);
        if (!target) {
          return;
        }
        void rpc.gotoLine(target.line, target.column);
        onClose();
        return;
      }
      const item = filtered[index];
      if (!item) {
        return;
      }
      if (parsed.mode === "help") {
        setQuery(prefixForHelp(item.id));
        return;
      }
      if (parsed.mode === "files") {
        void rpc.editor.open(item.id);
        onClose();
        return;
      }
      void rpc.execute(parsed.mode, item.id);
      onClose();
    },
    [filtered, onClose, parsed],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) =>
          filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1),
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        activate(selected);
        return;
      }
    },
    [activate, filtered.length, onClose, selected],
  );

  // Keep the highlighted item visible as the user arrows through.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-palette-index="${selected}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const onBackdropClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const gotoHint =
    parsed.mode === "gotoLine" ? parseGotoLine(parsed.search) : null;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[12vh]"
      onClick={onBackdropClick}
    >
      <div
        role="dialog"
        aria-label="Command Center"
        className="pointer-events-auto flex w-[640px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border/60 bg-popover/80 shadow-2xl backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="flex items-center gap-2 border-b border-border/50 px-3">
          <Search className="size-4 text-muted-foreground" />
          <span className="rounded-sm bg-accent/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
            {MODE_LABEL[parsed.mode]}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={MODE_PLACEHOLDER[parsed.mode]}
            autoComplete="off"
            spellCheck={false}
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {(loading || filesLoading) && <Spinner />}
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto scrollbar">
          {parsed.mode === "gotoLine" ? (
            <GotoLineHint target={gotoHint} />
          ) : filtered.length === 0 ? (
            <EmptyState
              mode={parsed.mode}
              query={parsed.search}
              loading={loading || filesLoading}
            />
          ) : (
            <ul className="py-1">
              {filtered.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-palette-index={i}
                    onMouseMove={() => setSelected(i)}
                    onClick={() => activate(i)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                      i === selected
                        ? "bg-accent/60 text-accent-foreground"
                        : "text-foreground hover:bg-accent/30",
                    )}
                  >
                    <span className="text-muted-foreground">
                      <ItemIcon icon={item.icon} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{item.title}</span>
                      {item.description && (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {item.detail && (
                      <span className="shrink-0 truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                    {item.hint && (
                      <span className="shrink-0 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.hint}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Footer mode={parsed.mode} />
      </div>
    </div>
  );
}

function filterFiles(
  files: FileEntry[],
  roots: FileEntry[],
  search: string,
): PaletteItem[] {
  if (files.length === 0) {
    return [];
  }
  const rootPaths = roots
    .map((r) => {
      // URIs for folders usually end without a trailing slash; normalize so
      // the prefix strip below doesn't leave a leading `/`.
      return r.path.endsWith("/") ? r.path : `${r.path}/`;
    })
    .sort((a, b) => b.length - a.length);
  const toRel = (path: string): string => {
    for (const root of rootPaths) {
      if (path.startsWith(root)) {
        return path.slice(root.length);
      }
    }
    return path;
  };
  const toItem = (f: FileEntry): PaletteItem => ({
    id: f.path,
    title: f.name,
    description: toRel(f.path),
    icon: "file",
  });

  const q = search.trim().toLowerCase();
  if (!q) {
    return files.slice(0, FILES_MAX_RESULTS).map(toItem);
  }

  // Score: lower is better. Prefer matches in the filename, then in the
  // relative path. Files that don't contain every character of the query
  // (in order) are filtered out entirely.
  const scored: Array<{ item: PaletteItem; score: number }> = [];
  for (const f of files) {
    const rel = toRel(f.path).toLowerCase();
    const name = f.name.toLowerCase();
    const nameIdx = name.indexOf(q);
    const relIdx = rel.indexOf(q);
    if (nameIdx < 0 && relIdx < 0) {
      if (!subsequenceMatch(rel, q)) {
        continue;
      }
      scored.push({ item: toItem(f), score: 500 });
      continue;
    }
    const score =
      nameIdx >= 0 ? nameIdx : 100 + (relIdx >= 0 ? relIdx : 0);
    scored.push({ item: toItem(f), score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, FILES_MAX_RESULTS).map((s) => s.item);
}

function subsequenceMatch(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) {
      i++;
      if (i === needle.length) {
        return true;
      }
    }
  }
  return false;
}

function parseQuery(raw: string): ParsedQuery {
  if (raw.startsWith(">")) {
    return { mode: "commands", search: raw.slice(1).trim(), rawPrefix: ">" };
  }
  if (raw.startsWith("@")) {
    return { mode: "symbols", search: raw.slice(1).trim(), rawPrefix: "@" };
  }
  if (raw.startsWith(":")) {
    return { mode: "gotoLine", search: raw.slice(1).trim(), rawPrefix: ":" };
  }
  if (raw.startsWith("?")) {
    return { mode: "help", search: raw.slice(1).trim(), rawPrefix: "?" };
  }
  return { mode: "files", search: raw.trim(), rawPrefix: "" };
}

function parseGotoLine(
  search: string,
): { line: number; column: number } | null {
  if (!search) {
    return null;
  }
  const match = /^(\d+)(?::(\d+))?$/.exec(search);
  if (!match) {
    return null;
  }
  const line = Number.parseInt(match[1], 10);
  const column = match[2] ? Number.parseInt(match[2], 10) : 1;
  if (!Number.isFinite(line) || line < 1) {
    return null;
  }
  return { line, column };
}

function prefixForHelp(id: string): string {
  switch (id) {
    case "help:commands":
      return "> ";
    case "help:files":
      return "";
    case "help:symbols":
      return "@";
    case "help:gotoLine":
      return ":";
    case "help:help":
      return "?";
    default:
      return "";
  }
}

function ItemIcon({ icon }: { icon: string | undefined }) {
  const className = "size-4";
  switch (icon) {
    case "file":
      return <FileIcon className={className} />;
    case "chevron-right":
      return <ChevronRight className={className} />;
    case "symbol-class":
    case "symbol-struct":
    case "symbol-interface":
    case "symbol-object":
      return <Box className={className} />;
    case "symbol-method":
    case "symbol-function":
    case "symbol-constructor":
      return <Code2 className={className} />;
    case "symbol-module":
    case "symbol-namespace":
    case "symbol-package":
      return <Package className={className} />;
    case "symbol-constant":
    case "symbol-number":
      return <Hash className={className} />;
    case "go-to-file":
      return <CornerDownLeft className={className} />;
    default:
      return <Circle className={className} />;
  }
}

function EmptyState({
  mode,
  query,
  loading,
}: {
  mode: Mode;
  query: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Buscando...
      </div>
    );
  }
  if ((mode === "files" || mode === "symbols") && !query) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
        <Search className="size-6 opacity-40" />
        <span>Digite para buscar {mode === "files" ? "arquivos" : "símbolos"}.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
      <CircleSlash className="size-6 opacity-40" />
      <span>Nada encontrado.</span>
    </div>
  );
}

function GotoLineHint({
  target,
}: {
  target: { line: number; column: number } | null;
}) {
  if (!target) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
        <HelpCircle className="size-6 opacity-40" />
        <span>Digite a linha (ex.: 42) ou linha:coluna (42:10).</span>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 text-sm">
      <div className="text-muted-foreground">Pressione Enter para ir para</div>
      <div className="mt-1 font-medium">
        Linha {target.line}
        <span className="text-muted-foreground">, coluna {target.column}</span>
      </div>
    </div>
  );
}

function Footer({ mode }: { mode: Mode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-background/30 px-3 py-1.5 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <Kbd>↑↓</Kbd> navegar
        <Kbd>↵</Kbd> selecionar
        <Kbd>Esc</Kbd> fechar
      </div>
      <div className="flex items-center gap-2">
        <ArrowDownUp className="size-3 opacity-60" />
        <span>
          Prefixos: <Kbd>&gt;</Kbd> <Kbd>@</Kbd> <Kbd>:</Kbd> <Kbd>?</Kbd>
        </span>
        <span className="rounded bg-accent/30 px-1 py-0.5">
          {MODE_LABEL[mode]}
        </span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border/70 bg-background/60 px-1 text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 animate-spin rounded-full border border-border border-t-foreground"
    />
  );
}
