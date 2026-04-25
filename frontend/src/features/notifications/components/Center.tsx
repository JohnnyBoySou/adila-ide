import { Bell, Search, Trash2, X } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useNotificationsStore } from "@/stores/notificationsStore";
import { rpc } from "../rpc";
import { Toast } from "./Toast";

/**
 * NotificationsView — tela cheia (não mais painel deslizante).
 *
 * Renderizada quando `view === "notifications"` no App. Lê os items diretamente
 * do useNotificationsStore — o componente <Notifications/> em <Overlays/> é
 * quem mantém as subscrições RPC e atualiza o store.
 */
export const NotificationsView = memo(function NotificationsView() {
  const items = useNotificationsStore((s) => s.items);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.message.toLowerCase().includes(q) ||
        (item.source ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const showingCount = filtered.length;
  const totalCount = items.length;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="flex flex-col gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold tracking-tight">Notificações</h2>
          {totalCount > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {totalCount}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
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
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
                onClick={() => setQuery("")}
                aria-label="Limpar busca"
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          {query && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {showingCount} de {totalCount}{" "}
              {totalCount === 1 ? "notificação" : "notificações"}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar">
        <div className="mx-auto max-w-3xl px-6 py-6">
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
              <AnimatePresence initial={false}>
                {filtered.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      scale: 0.96,
                      transition: { duration: 0.15 },
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  >
                    <Toast item={item} inCenter />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

interface EmptyStateProps {
  icon: typeof Bell;
  title: string;
  hint: string;
}

function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 px-6 text-center text-muted-foreground">
      <Icon className="size-8 opacity-30" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/80">{hint}</p>
    </div>
  );
}
