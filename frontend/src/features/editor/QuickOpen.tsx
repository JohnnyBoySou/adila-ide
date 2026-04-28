import { useEffect, useRef, useState } from "react";
import { Hash, Search } from "lucide-react";
import { SearchFiles } from "../../../wailsjs/go/main/App";
import { SearchSymbols } from "../../../wailsjs/go/main/Indexer";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
import { SymbolIcon } from "@/components/SymbolIcon";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type FileEntry = { name: string; path: string; isDir: boolean };
type SymbolEntry = {
  name: string;
  kind: string;
  scope?: string;
  path: string;
  line: number;
  col: number;
  endLine?: number;
  signature?: string;
};

type Mode = "files" | "symbols";

type Props = {
  open: boolean;
  rootPath: string;
  onClose: () => void;
  onOpenFile: (path: string) => void;
};

// Mapeia kind do indexador → label curta + classe utilitária. Manter aqui
// (em vez de espalhar por componente) facilita ajustar o esquema visual num
// só lugar quando adicionarmos novos kinds.
const KIND_VISUAL: Record<string, { label: string; className: string }> = {
  function: { label: "fn", className: "bg-blue-500/15 text-blue-400" },
  method: { label: "m", className: "bg-cyan-500/15 text-cyan-400" },
  class: { label: "cl", className: "bg-amber-500/15 text-amber-500" },
  struct: { label: "st", className: "bg-amber-500/15 text-amber-500" },
  interface: { label: "if", className: "bg-purple-500/15 text-purple-400" },
  enum: { label: "en", className: "bg-pink-500/15 text-pink-400" },
  type: { label: "ty", className: "bg-emerald-500/15 text-emerald-500" },
  const: { label: "co", className: "bg-orange-500/15 text-orange-400" },
  var: { label: "var", className: "bg-zinc-500/15 text-zinc-400" },
  macro: { label: "mac", className: "bg-rose-500/15 text-rose-400" },
  module: { label: "mod", className: "bg-violet-500/15 text-violet-400" },
};

function KindBadge({ kind }: { kind: string }) {
  const v = KIND_VISUAL[kind] ?? { label: kind.slice(0, 3), className: "bg-muted text-foreground" };
  return (
    <span
      className={cn(
        "text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
        v.className,
      )}
    >
      {v.label}
    </span>
  );
}

export function QuickOpen({ open, rootPath, onClose, onOpenFile }: Props) {
  const [mode, setMode] = useState<Mode>("files");
  const [query, setQuery] = useState("");
  const [fileResults, setFileResults] = useState<FileEntry[]>([]);
  const [symbolResults, setSymbolResults] = useState<SymbolEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results: { kind: "file" | "symbol"; key: string }[] =
    mode === "files"
      ? fileResults.map((r) => ({ kind: "file", key: r.path }))
      : symbolResults.map((s) => ({
          kind: "symbol",
          key: `${s.path}:${s.line}:${s.col}:${s.name}`,
        }));
  const total = results.length;

  // Reset ao abrir. Mantemos o último mode escolhido entre aberturas — quem
  // costuma abrir Símbolos provavelmente vai querer abrir de novo.
  useEffect(() => {
    if (open) {
      setQuery("");
      setFileResults([]);
      setSymbolResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Atalho `@` no início do input troca para Símbolos (padrão do VSCode).
  // Só aciona quando estamos em "files" e o caractere veio como prefixo.
  useEffect(() => {
    if (mode === "files" && query.startsWith("@")) {
      setMode("symbols");
      setQuery(query.slice(1));
    }
  }, [query, mode]);

  // Search debouncado, separado por mode pra não cancelar requests cruzados.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setFileResults([]);
      setSymbolResults([]);
      return;
    }
    if (mode === "files") {
      if (!rootPath) return;
      const t = setTimeout(() => {
        SearchFiles(rootPath, q)
          .then((r) => {
            setFileResults(r ?? []);
            setActiveIndex(0);
          })
          .catch(() => setFileResults([]));
      }, 80);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      SearchSymbols(q, 100)
        .then((r) => {
          setSymbolResults((r ?? []) as SymbolEntry[]);
          setActiveIndex(0);
        })
        .catch(() => setSymbolResults([]));
    }, 80);
    return () => clearTimeout(t);
  }, [query, mode, rootPath, open]);

  // Navegação por teclado. Tab alterna entre tabs sem precisar mexer no mouse.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, total - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Tab") {
        e.preventDefault();
        setMode((m) => (m === "files" ? "symbols" : "files"));
        setActiveIndex(0);
      } else if (e.key === "Enter") {
        confirmActive();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // confirmActive depende de fileResults/symbolResults/activeIndex/mode;
    // capturamos via closure no listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total, mode, fileResults, symbolResults, activeIndex]);

  // Scroll item ativo pra view.
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function confirmActive() {
    if (mode === "files") {
      const r = fileResults[activeIndex];
      if (!r) return;
      onOpenFile(r.path);
      onClose();
      return;
    }
    const s = symbolResults[activeIndex];
    if (!s) return;
    onOpenFile(s.path);
    // O editor abre o arquivo em background; aguardamos o paint pra evitar
    // que o gotoLine seja descartado por um modelo que ainda nem montou.
    setTimeout(() => EventsEmit("editor.gotoLine", { line: s.line + 1, column: s.col + 1 }), 80);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      ariaLabel={mode === "files" ? "Abrir arquivo" : "Ir para símbolo"}
      className="w-[560px] max-w-[90vw] overflow-hidden"
    >
      {/* Tabs — Tab alterna; clique também alterna pra mouse-only. */}
      <div className="flex items-center gap-1 px-2 pt-2 border-b">
        <TabButton
          active={mode === "files"}
          onClick={() => setMode("files")}
          icon={<Search className="size-3.5" />}
          label="Arquivos"
          hint="Ctrl+P"
        />
        <TabButton
          active={mode === "symbols"}
          onClick={() => setMode("symbols")}
          icon={<Hash className="size-3.5" />}
          label="Símbolos"
          hint="@ ou Tab"
        />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b">
        {mode === "files" ? (
          <Search className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <Hash className="size-4 text-muted-foreground shrink-0" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mode === "files" ? "Abrir arquivo…" : "Buscar símbolo no índice…"}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Esc</kbd>
      </div>

      <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
        {total === 0 && query.trim() && (
          <EmptyState
            title={mode === "files" ? "Nenhum arquivo encontrado" : "Nenhum símbolo encontrado"}
            description={
              mode === "symbols" ? "O índice pode ainda estar sendo construído." : undefined
            }
          />
        )}
        {total === 0 && !query.trim() && (
          <EmptyState
            title={mode === "files" ? "Digite para buscar arquivos" : "Digite para buscar símbolos"}
          />
        )}
        {mode === "files" &&
          fileResults.map((r, i) => {
            const name = r.name || r.path.split("/").pop() || r.path;
            const dir = r.path.includes("/") ? r.path.slice(0, r.path.lastIndexOf("/")) : "";
            return (
              <button
                key={r.path}
                onClick={() => {
                  onOpenFile(r.path);
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition-colors",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <SymbolIcon name={name} isDir={false} className="size-4 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="text-sm block truncate">{name}</span>
                  {dir && (
                    <span className="text-xs text-muted-foreground truncate block">{dir}</span>
                  )}
                </span>
              </button>
            );
          })}
        {mode === "symbols" &&
          symbolResults.map((s, i) => {
            const fileName = s.path.split("/").pop() || s.path;
            const relDir =
              rootPath && s.path.startsWith(rootPath) ? s.path.slice(rootPath.length + 1) : s.path;
            const where = `${relDir}:${s.line + 1}`;
            return (
              <button
                key={`${s.path}:${s.line}:${s.col}:${s.name}`}
                onClick={() => {
                  onOpenFile(s.path);
                  setTimeout(
                    () => EventsEmit("editor.gotoLine", { line: s.line + 1, column: s.col + 1 }),
                    80,
                  );
                  onClose();
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition-colors",
                  i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <KindBadge kind={s.kind} />
                <span className="flex-1 min-w-0">
                  <span className="text-sm flex items-baseline gap-1.5">
                    <span className="truncate font-medium">{s.name}</span>
                    {s.scope && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        on {s.scope}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate block">{where}</span>
                </span>
                <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">
                  {fileName}
                </span>
              </button>
            );
          })}
      </div>
    </Dialog>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
      )}
    >
      {icon}
      {label}
      <kbd className="text-[9px] bg-background/60 px-1 py-0.5 rounded ml-1">{hint}</kbd>
    </button>
  );
}
