import { Bell, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { rpc } from "../rpc";
import type { NotificationItem } from "../types";
import { Toast } from "./Toast";

interface CenterProps {
  items: NotificationItem[];
  open: boolean;
  onClose: () => void;
}

export function Center({ items, open, onClose }: CenterProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Reset the search field when the panel closes so a reopen starts clean.
  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter((item) => {
      return (
        item.message.toLowerCase().includes(q) ||
        (item.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  const showingCount = filtered.length;
  const totalCount = items.length;

  return (
    <div
      role="dialog"
      aria-modal={open}
      aria-hidden={!open}
      aria-label="Notificações"
      className={cn(
        "fixed inset-0 z-50 flex transition-opacity duration-200 ease-out",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-[backdrop-filter,opacity] duration-200 ease-out",
          open ? "backdrop-blur-[2px] opacity-100" : "backdrop-blur-0 opacity-0",
        )}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative ml-auto flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex flex-col gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">
                Notificações
              </h2>
              {totalCount > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {totalCount}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                }}
                placeholder="Pesquisar notificações..."
                aria-label="Pesquisar notificações"
                className={cn(
                  "h-8 w-full rounded-md border border-border bg-muted/40 pl-7 pr-7 text-xs",
                  "placeholder:text-muted-foreground/70",
                  "outline-none transition-colors focus:border-primary/50 focus:bg-background",
                )}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                  }}
                  aria-label="Limpar busca"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={totalCount === 0}
              onClick={() => {
                void rpc.clearAll();
              }}
              title="Limpar todas as notificações"
              aria-label="Limpar todas"
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs",
                "text-muted-foreground transition-colors",
                "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive",
                "disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
              )}
            >
              <Trash2 className="size-3.5" />
              <span>Limpar tudo</span>
            </button>
          </div>

          {query && (
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {showingCount} de {totalCount} {totalCount === 1 ? "notificação" : "notificações"}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {totalCount === 0 ? (
            <EmptyState
              icon={Bell}
              title="Sem notificações"
              hint="Quando o workbench emitir alertas, eles aparecerão aqui."
            />
          ) : showingCount === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              hint={`Nada corresponde a "${query.trim()}".`}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => <Toast key={item.id} item={item} inCenter />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: typeof Bell;
  title: string;
  hint: string;
}

function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
      <Icon className="size-8 opacity-30" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/80">{hint}</p>
    </div>
  );
}
