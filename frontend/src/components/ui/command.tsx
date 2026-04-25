import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  title: string;
  description?: ReactNode;
  keywords?: string[];
}

interface CommandProps<T extends CommandItem> {
  items: T[];
  placeholder?: string;
  emptyMessage?: string;
  onSelect: (item: T) => void;
  footer?: ReactNode;
}

function filterItems<T extends CommandItem>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return items;
  }
  return items.filter((item) =>
    [
      item.title,
      typeof item.description === "string" ? item.description : "",
      ...(item.keywords ?? []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export function Command<T extends CommandItem>({
  items,
  placeholder,
  emptyMessage,
  onSelect,
  footer,
}: CommandProps<T>) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => filterItems(items, query), [items, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-command-index="${index}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [index]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (filtered.length === 0 ? 0 : Math.min(i + 1, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[index];
      if (item) {
        onSelect(item);
      }
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center border-b border-border px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? "Buscar..."}
          className="h-11 w-full bg-transparent pl-3 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div ref={listRef} className="max-h-80 overflow-y-auto scrollbar p-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage ?? "Nada encontrado."}
          </div>
        ) : (
          filtered.map((item, i) => (
            <button
              type="button"
              key={item.id}
              data-command-index={i}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onSelect(item)}
              className={cn(
                "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left text-sm transition-colors",
                i === index ? "bg-accent text-accent-foreground" : "text-foreground",
              )}
            >
              <span className="font-medium">{item.title}</span>
              {item.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {item.description}
                </span>
              )}
            </button>
          ))
        )}
      </div>
      {footer && (
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
