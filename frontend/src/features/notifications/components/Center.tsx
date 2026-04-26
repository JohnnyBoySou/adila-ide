import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotificationsStore } from "@/stores/notificationsStore";
import { cn } from "@/lib/utils";
import { Bell, GitBranch, Search, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useMemo, useState } from "react";
import { rpc } from "../rpc";
import { GitHubNotifications } from "./GitHubNotifications";
import { Toast } from "./Toast";

type Tab = "workbench" | "github";

export const NotificationsView = memo(function NotificationsView() {
  const items = useNotificationsStore((s) => s.items);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("workbench");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.message.toLowerCase().includes(q) || (item.source ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  const showingCount = filtered.length;
  const totalCount = items.length;

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <header className="flex flex-col gap-3 border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 p-0.5">
            <button
              type="button"
              onClick={() => setTab("workbench")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                tab === "workbench"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Bell className="size-3.5" />
              Workbench
            </button>
            <button
              type="button"
              onClick={() => setTab("github")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                tab === "github"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GitBranch className="size-3.5" />
              GitHub
            </button>
          </div>
          <div className="relative flex-1 max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === "workbench"
                  ? "Pesquisar notificações..."
                  : "Pesquisar notificações do GitHub..."
              }
              aria-label="Pesquisar notificações"
              className="h-8"
            />
          </div>
          {tab === "workbench" && query && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {showingCount} de {totalCount} {totalCount === 1 ? "notificação" : "notificações"}
            </span>
          )}
          {tab === "workbench" && (
            <Button
              variant="outline"
              size="sm"
              disabled={totalCount === 0}
              onClick={() => {
                void rpc.clearAll();
              }}
              title="Limpar todas as notificações"
              aria-label="Limpar todas"
            >
              <Trash2 className="size-3.5" />
              <span>Limpar tudo</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar">
        <div className="mx-auto max-w-3xl px-6 py-6">
          {tab === "workbench" ? (
            totalCount === 0 ? (
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
            )
          ) : (
            <GitHubNotifications query={query} />
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
