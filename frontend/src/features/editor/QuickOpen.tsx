import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SearchFiles } from "../../../wailsjs/go/main/App";
import { SymbolIcon } from "@/components/SymbolIcon";

type FileEntry = { name: string; path: string; isDir: boolean };

type Props = {
  open: boolean;
  rootPath: string;
  onClose: () => void;
  onOpenFile: (path: string) => void;
};

export function QuickOpen({ open, rootPath, onClose, onOpenFile }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FileEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !rootPath) return;
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => {
      SearchFiles(rootPath, query)
        .then((r) => { setResults(r ?? []); setActiveIndex(0); })
        .catch(() => setResults([]));
    }, 80);
    return () => clearTimeout(timer);
  }, [query, rootPath, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[activeIndex]) {
        onOpenFile(results[activeIndex].path);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, activeIndex, onClose, onOpenFile]);

  // scroll item ativo para a view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-[560px] bg-popover border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Abrir arquivo…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && query.trim() && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum arquivo encontrado
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Digite para buscar arquivos
            </div>
          )}
          {results.map((r, i) => {
            const name = r.name || r.path.split("/").pop() || r.path;
            const dir = r.path.includes("/") ? r.path.slice(0, r.path.lastIndexOf("/")) : "";
            return (
              <button
                key={r.path}
                onClick={() => { onOpenFile(r.path); onClose(); }}
                className={
                  "w-full text-left px-3 py-1.5 flex items-center gap-2.5 transition-colors " +
                  (i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50")
                }
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
        </div>
      </div>
    </div>
  );
}
