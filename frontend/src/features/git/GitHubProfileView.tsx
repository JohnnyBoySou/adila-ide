import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/useToast";
import { call } from "@/rpc/core";
import { GithubIcon } from "./GithubIcon";
import { GitHubConnect } from "./GitHubConnect";
import { rpc } from "./rpc";
import type { GitHubUser } from "./types";

function formatJoinDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function GitHubProfileView() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await rpc.github.isAuthenticated();
      if (!auth) {
        setUser(null);
        return;
      }
      const u = await rpc.github.getUser();
      setUser(u);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await rpc.github.logout();
      setUser(null);
      toast.success("Desconectado do GitHub");
    } catch (err: unknown) {
      toast.error("Erro ao desconectar", err);
    }
  }, []);

  const openProfile = useCallback(() => {
    if (!user?.htmlUrl) return;
    call("shell.openUrl", { url: user.htmlUrl }).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" label="Carregando perfil…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={GithubIcon}
          title="Não foi possível carregar o perfil"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
              <RefreshCw className="size-3.5" />
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="flex h-full items-center justify-center">
          <EmptyState
            icon={GithubIcon}
            title="Conecte sua conta do GitHub"
            description="Faça login pra ver seu perfil, publicar repositórios e sincronizar branches direto da IDE."
            action={
              <Button onClick={() => setConnectOpen(true)} className="gap-2">
                <GithubIcon className="size-4" />
                Entrar com GitHub
              </Button>
            }
          />
        </div>
        <GitHubConnect
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onAuthenticated={(u) => {
            setUser(u);
            void refresh();
          }}
        />
      </>
    );
  }

  const joinDate = formatJoinDate(user.createdAt);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.login}
              className="size-24 rounded-full border border-border/60"
            />
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full border border-border/60 bg-muted">
              <GithubIcon className="size-10 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {user.name && <h2 className="text-xl font-semibold">{user.name}</h2>}
            <span className="text-base text-muted-foreground">@{user.login}</span>
          </div>
          {user.bio && <p className="text-sm text-foreground/90">{user.bio}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={openProfile} className="gap-2">
              <ExternalLink className="size-3.5" />
              Ver no GitHub
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh} className="gap-2">
              <RefreshCw className="size-3.5" />
              Atualizar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="ml-auto gap-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-3.5" />
              Desconectar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="gap-1.5">
          <span className="font-semibold tabular-nums">{user.publicRepos ?? 0}</span>
          <span className="text-muted-foreground">repositórios</span>
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Users className="size-3" />
          <span className="font-semibold tabular-nums">{user.followers ?? 0}</span>
          <span className="text-muted-foreground">seguidores</span>
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <span className="font-semibold tabular-nums">{user.following ?? 0}</span>
          <span className="text-muted-foreground">seguindo</span>
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {user.company && <Detail icon={Building2}>{user.company}</Detail>}
        {user.location && <Detail icon={MapPin}>{user.location}</Detail>}
        {user.email && (
          <Detail icon={Mail}>
            <a href={`mailto:${user.email}`} className="hover:underline">
              {user.email}
            </a>
          </Detail>
        )}
        {user.blog && (
          <Detail icon={Globe}>
            <button
              type="button"
              onClick={() => call("shell.openUrl", { url: normalizeUrl(user.blog!) }).catch(() => {})}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {user.blog}
              <LinkIcon className="size-3" />
            </button>
          </Detail>
        )}
        {joinDate && <Detail icon={Calendar}>Membro desde {joinDate}</Detail>}
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  children,
}: {
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground/80">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
