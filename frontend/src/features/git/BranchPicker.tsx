import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Check, GitBranch as GitBranchIcon, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface BranchPickerProps {
  current: string;
  branches: string[];
  onCheckout: (name: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

export const BranchPicker = memo(function BranchPicker({
  current,
  branches,
  onCheckout,
  onCreate,
  onClose,
}: BranchPickerProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.toLowerCase().includes(q));
  }, [branches, query]);

  const trimmed = query.trim();
  const canCreate = trimmed.length > 0 && !branches.includes(trimmed);
  const totalRows = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-branch-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      if (rootRef.current?.contains(target)) return;
      if (target?.closest("[data-branch-trigger='true']")) return;
      onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  function commitIndex(i: number) {
    if (i < filtered.length) {
      const name = filtered[i];
      if (name && name !== current) onCheckout(name);
      onClose();
      return;
    }
    if (canCreate) {
      onCreate(trimmed);
      onClose();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (totalRows === 0 ? 0 : Math.min(i + 1, totalRows - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitIndex(index);
    }
  }

  return (
    <div
      ref={rootRef}
      className="absolute left-2 right-2 top-full z-30 mt-1 overflow-hidden rounded-md border border-border/60 bg-popover text-popover-foreground shadow-lg"
    >
      <div className="flex items-center border-b border-border/60 px-2">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar ou criar branch..."
          className="h-8 w-full bg-transparent pl-2 text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div ref={listRef} className="max-h-64 overflow-y-auto scrollbar p-1 text-xs">
        {filtered.length === 0 && !canCreate && (
          <div className="py-4 text-center text-muted-foreground">Nenhuma branch.</div>
        )}
        {filtered.map((name, i) => (
          <button
            key={name}
            type="button"
            data-branch-index={i}
            onMouseEnter={() => setIndex(i)}
            onClick={() => commitIndex(i)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left",
              i === index ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
              name === current && "font-medium text-primary",
            )}
          >
            <GitBranchIcon className="size-3 shrink-0" />
            <span className="flex-1 truncate">{name}</span>
            {name === current && <Check className="size-3 shrink-0" />}
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            data-branch-index={filtered.length}
            onMouseEnter={() => setIndex(filtered.length)}
            onClick={() => commitIndex(filtered.length)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left border-t border-border/40 mt-1",
              index === filtered.length ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
            )}
          >
            <Plus className="size-3 shrink-0" />
            <span className="flex-1 truncate">
              Criar branch <span className="font-medium">{trimmed}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
});
