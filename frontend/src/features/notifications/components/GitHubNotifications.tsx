import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { Check, ExternalLink, GitBranch, GitPullRequest, MessageSquare, Tag } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import {
  GetNotifications,
  IsAuthenticated,
  MarkAllNotificationsRead,
  MarkNotificationRead,
} from "../../../../wailsjs/go/main/GitHub";
import { BrowserOpenURL, EventsOn } from "../../../../wailsjs/runtime/runtime";
import type { main as gh } from "../../../../wailsjs/go/models";

type Item = gh.GitHubNotification;

function relTime(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(t).toLocaleDateString();
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "assign":
      return "Atribuído";
    case "author":
      return "Autor";
    case "comment":
      return "Comentário";
    case "ci_activity":
      return "CI";
    case "invitation":
      return "Convite";
    case "manual":
      return "Manual";
    case "mention":
      return "Mencionado";
    case "review_requested":
      return "Review pedido";
    case "security_alert":
      return "Alerta de segurança";
    case "state_change":
      return "Estado alterado";
    case "subscribed":
      return "Inscrito";
    case "team_mention":
      return "Time mencionado";
    default:
      return reason;
  }
}

function TypeIcon({ type }: { type: string }) {
  if (type === "PullRequest") return <GitPullRequest className="size-4" />;
  if (type === "Release") return <Tag className="size-4" />;
  if (type === "Discussion" || type === "Issue") return <MessageSquare className="size-4" />;
  return <GitBranch className="size-4" />;
}

interface Props {
  query: string;
}

export const GitHubNotifications = memo(function GitHubNotifications({ query }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await GetNotifications(false);
      setItems(res ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    IsAuthenticated()
      .then((v) => {
        if (!cancelled) setAuthed(!!v);
      })
      .catch(() => !cancelled && setAuthed(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    void refresh();
    const off = EventsOn("github.changed", () => {
      void refresh();
    });
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [authed, refresh]);

  const filtered = query.trim()
    ? items.filter((n) => {
        const q = query.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.repoFull.toLowerCase().includes(q) ||
          reasonLabel(n.reason).toLowerCase().includes(q)
        );
      })
    : items;

  if (authed === null) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  if (!authed) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <GitBranch className="size-8 opacity-30" />
        <p className="text-sm font-medium text-foreground">Conecte sua conta do GitHub</p>
        <p className="text-xs text-muted-foreground/80">
          Vá em Controle de versão → Conectar GitHub para ver suas notificações aqui.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-destructive">Falha ao buscar notificações.</p>
        <p className="text-xs text-muted-foreground max-w-md break-words">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Buscando…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
        <Check className="size-8 opacity-30" />
        <p className="text-sm font-medium text-foreground">Inbox limpa</p>
        <p className="text-xs text-muted-foreground/80">Nenhuma notificação não lida no GitHub.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "notificação" : "notificações"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            MarkAllNotificationsRead()
              .then(() => void refresh())
              .catch((e: unknown) => toast.error("Não foi possível marcar tudo como lido", e));
          }}
        >
          Marcar tudo como lido
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {filtered.map((n) => (
          <article
            key={n.id}
            className={cn(
              "group flex items-start gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2.5 transition-colors hover:bg-accent/40",
              n.unread && "border-primary/40",
            )}
          >
            <div className="mt-0.5 shrink-0 text-muted-foreground">
              <TypeIcon type={n.type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {n.repoAvatar && <img src={n.repoAvatar} alt="" className="size-4 rounded-sm" />}
                <span className="font-mono truncate">{n.repoFull}</span>
                <span className="opacity-50">·</span>
                <span>{reasonLabel(n.reason)}</span>
                <span className="opacity-50">·</span>
                <span>{relTime(n.updatedAt)}</span>
              </div>
              <p className={cn("mt-0.5 text-sm leading-snug", n.unread && "font-medium")}>
                {n.title}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {n.htmlUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Abrir no GitHub"
                  onClick={() => BrowserOpenURL(n.htmlUrl)}
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Marcar como lido"
                onClick={() => {
                  MarkNotificationRead(n.id)
                    .then(() => void refresh())
                    .catch((e: unknown) => toast.error("Não foi possível marcar como lido", e));
                }}
              >
                <Check className="size-3.5" />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
});
