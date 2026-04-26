import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  GitFork,
  Globe,
  Link as LinkIcon,
  Lock,
  LogOut,
  Mail,
  MapPin,
  RefreshCw,
  Star,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/useToast";
import { call } from "@/rpc/core";
import { cn } from "@/lib/utils";
import { GithubIcon } from "./GithubIcon";
import { GitHubConnect } from "./GitHubConnect";
import { CloneRepoDialog } from "./CloneRepoDialog";
import { rpc } from "./rpc";
import type { GitHubUser } from "./types";
import { ListMyEvents, ListMyRepos } from "../../../wailsjs/go/main/GitHub";
import type { main as gh } from "../../../wailsjs/go/models";

type Repo = gh.GitHubUserRepo;
type Event = gh.GitHubEvent;

const CACHE_KEY = "adila.github.profile.v1";

type ProfileCache = {
  user: GitHubUser;
  repos: Repo[];
  events: Event[];
  ts: number;
};

function readCache(): ProfileCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileCache;
    if (!parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: ProfileCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* quota — ignore */
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function formatJoinDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function relTime(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}sem`;
  return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// Cores aproximadas (subset do github-linguist) para os bullets de linguagem.
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Go: "#00ADD8",
  Python: "#3572A5",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Lua: "#000080",
  Dart: "#00B4AB",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  R: "#198CE7",
  Dockerfile: "#384d54",
};

function langColor(lang: string): string {
  return LANG_COLORS[lang] ?? "#94a3b8";
}

type Props = {
  onOpenFolder?: (path: string) => void;
  overlayOpen?: boolean;
  onClose?: () => void;
};

export function GitHubProfileView({ onOpenFolder, overlayOpen, onClose }: Props = {}) {
  if (overlayOpen === false) return null;
  const cached = useMemo(() => readCache(), []);
  const [user, setUser] = useState<GitHubUser | null>(cached?.user ?? null);
  const [repos, setRepos] = useState<Repo[]>(cached?.repos ?? []);
  const [events, setEvents] = useState<Event[]>(cached?.events ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [tab, setTab] = useState<"repos" | "activity">("repos");
  const [cloneRepo, setCloneRepo] = useState<Repo | null>(null);

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const auth = await rpc.github.isAuthenticated();
      if (!auth) {
        setUser(null);
        setRepos([]);
        setEvents([]);
        clearCache();
        return;
      }
      const u = await rpc.github.getUser();
      setUser(u);
      const [rs, evs] = await Promise.all([
        ListMyRepos(30).catch(() => [] as Repo[]),
        ListMyEvents(u.login, 30).catch(() => [] as Event[]),
      ]);
      const repoList = rs ?? [];
      const evList = evs ?? [];
      setRepos(repoList);
      setEvents(evList);
      writeCache({ user: u, repos: repoList, events: evList, ts: Date.now() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Só mostra erro pra UI se não temos nada em cache
      if (!cached) {
        setError(msg);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [cached]);

  useEffect(() => {
    // Se temos cache, revalida em background sem spinner; senão mostra loading
    void refresh(!cached);
  }, [refresh, cached]);

  const logout = useCallback(async () => {
    try {
      await rpc.github.logout();
      setUser(null);
      setRepos([]);
      setEvents([]);
      clearCache();
      toast.success("Desconectado do GitHub");
    } catch (err: unknown) {
      toast.error("Erro ao desconectar", err);
    }
  }, []);

  const openProfile = useCallback(() => {
    if (!user?.htmlUrl) return;
    call("shell.openUrl", { url: user.htmlUrl }).catch(() => {});
  }, [user]);

  const openUrl = useCallback((url: string) => {
    if (!url) return;
    call("shell.openUrl", { url }).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const stars = repos.reduce((acc, r) => acc + (r.stars || 0), 0);
    const forks = repos.reduce((acc, r) => acc + (r.forks || 0), 0);
    const archived = repos.filter((r) => r.archived).length;
    const langs = new Map<string, number>();
    for (const r of repos) {
      if (!r.language) continue;
      langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
    }
    const langTotal = [...langs.values()].reduce((a, b) => a + b, 0);
    const langList = [...langs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count, pct: langTotal ? count / langTotal : 0 }));
    return { stars, forks, archived, langs: langList };
  }, [repos]);

  if (loading && !user) {
    return (
      <OverlayShell onClose={onClose}>
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" label="Carregando perfil…" />
        </div>
      </OverlayShell>
    );
  }

  if (error) {
    return (
      <OverlayShell onClose={onClose}>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={GithubIcon}
            title="Não foi possível carregar o perfil"
            description={error}
            action={
              <Button variant="outline" size="sm" onClick={() => void refresh(true)} className="gap-2">
                <RefreshCw className="size-3.5" />
                Tentar novamente
              </Button>
            }
          />
        </div>
      </OverlayShell>
    );
  }

  if (!user) {
    return (
      <OverlayShell onClose={onClose}>
        <div className="flex flex-1 items-center justify-center">
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
            void refresh(true);
          }}
        />
      </OverlayShell>
    );
  }

  const joinDate = formatJoinDate(user.createdAt);

  return (
    <OverlayShell onClose={onClose}>
    <div className="flex-1 overflow-y-auto scrollbar">
      {/* Banner gradiente */}
      <div className="relative h-32 bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 border-b border-border/40">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, ${langColor(stats.langs[0]?.name ?? "")}55 0%, transparent 50%), radial-gradient(circle at 80% 20%, ${langColor(stats.langs[1]?.name ?? "")}55 0%, transparent 50%)`,
          }}
        />
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pb-12">
        {/* Cabeçalho com avatar sobreposto */}
        <header className="flex flex-col gap-4 -mt-12 sm:flex-row sm:items-end">
          <div className="shrink-0">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.login}
                className="size-28 rounded-full border-4 border-background bg-background shadow-lg"
              />
            ) : (
              <div className="flex size-28 items-center justify-center rounded-full border-4 border-background bg-muted shadow-lg">
                <GithubIcon className="size-12 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-1.5 sm:pb-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {user.name && <h2 className="text-2xl font-bold">{user.name}</h2>}
              <span className="text-base text-muted-foreground">@{user.login}</span>
            </div>
            {user.bio && <p className="text-sm text-foreground/90 max-w-prose">{user.bio}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:pb-2">
            <Button variant="default" size="sm" onClick={openProfile} className="gap-2">
              <ExternalLink className="size-3.5" />
              Ver no GitHub
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh(true)}
              title="Atualizar"
              aria-label="Atualizar"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Desconectar"
              aria-label="Desconectar"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Repositórios" value={user.publicRepos ?? 0} icon={GithubIcon} />
          <StatCard label="Estrelas ganhas" value={stats.stars} icon={Star} accent="amber" />
          <StatCard label="Seguidores" value={user.followers ?? 0} icon={Users} accent="blue" />
          <StatCard label="Seguindo" value={user.following ?? 0} icon={Users} />
        </div>

        {/* Detalhes pessoais */}
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
                onClick={() => openUrl(normalizeUrl(user.blog!))}
                className="inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                {user.blog}
                <LinkIcon className="size-3" />
              </button>
            </Detail>
          )}
          {joinDate && <Detail icon={Calendar}>Membro desde {joinDate}</Detail>}
        </div>

        {/* Top languages */}
        {stats.langs.length > 0 && (
          <section className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Linguagens em uso</h3>
              <span className="text-[10px] text-muted-foreground">
                top {stats.langs.length} de {user.publicRepos ?? 0} repos
              </span>
            </div>
            {/* Barra empilhada */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {stats.langs.map((l) => (
                <div
                  key={l.name}
                  style={{ width: `${l.pct * 100}%`, backgroundColor: langColor(l.name) }}
                  title={`${l.name} · ${l.count} repos`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {stats.langs.map((l) => (
                <div key={l.name} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: langColor(l.name) }}
                  />
                  <span className="font-medium">{l.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {(l.pct * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tabs Repos / Atividade */}
        <section>
          <div className="mb-3 flex items-center gap-1 border-b border-border/60">
            <TabButton active={tab === "repos"} onClick={() => setTab("repos")}>
              Repositórios
              <Badge variant="secondary" className="ml-1.5">
                {repos.length}
              </Badge>
            </TabButton>
            <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>
              Atividade recente
              <Badge variant="secondary" className="ml-1.5">
                {events.length}
              </Badge>
            </TabButton>
          </div>

          {tab === "repos" &&
            (repos.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhum repositório encontrado.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {repos.map((r) => (
                  <RepoCard
                    key={r.fullName}
                    repo={r}
                    onClone={() => setCloneRepo(r)}
                    onOpenExternal={() => openUrl(r.htmlUrl)}
                  />
                ))}
              </div>
            ))}

          {tab === "activity" &&
            (events.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Sem eventos públicos recentes.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/40 rounded-lg border border-border/60 bg-card/40">
                {events.map((ev) => (
                  <EventRow key={ev.id} event={ev} onOpen={openUrl} />
                ))}
              </ul>
            ))}
        </section>
      </div>

      <CloneRepoDialog
        repo={cloneRepo}
        open={!!cloneRepo}
        onOpenChange={(o) => {
          if (!o) setCloneRepo(null);
        }}
        onCloned={(path) => onOpenFolder?.(path)}
      />
    </div>
    </OverlayShell>
  );
}

function OverlayShell({
  onClose,
  children,
}: {
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col overflow-hidden">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar"
          className="absolute top-3 right-4 z-50 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150 active:scale-90"
        >
          <X className="size-4" />
        </button>
      )}
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: "amber" | "blue";
}) {
  const accentClass =
    accent === "amber"
      ? "text-amber-400"
      : accent === "blue"
        ? "text-blue-400"
        : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-4 py-3 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className={cn("size-3.5", accentClass)} />
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Detail({ icon: Icon, children }: { icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground/80">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RepoCard({
  repo,
  onClone,
  onOpenExternal,
}: {
  repo: Repo;
  onClone: () => void;
  onOpenExternal: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClone}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClone();
        }
      }}
      title="Clonar repositório"
      className="group text-left flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3 transition-all hover:border-primary/40 hover:bg-accent/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-sm font-semibold text-primary group-hover:underline">
            {repo.name}
          </span>
          {repo.private && (
            <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="privado" />
          )}
          {repo.fork && (
            <GitFork className="size-3 shrink-0 text-muted-foreground" aria-label="fork" />
          )}
          {repo.archived && (
            <Archive className="size-3 shrink-0 text-amber-500" aria-label="arquivado" />
          )}
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onOpenExternal();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onOpenExternal();
            }
          }}
          title="Abrir no GitHub"
          aria-label="Abrir no GitHub"
          className="shrink-0 rounded p-1 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground hover:bg-accent/40"
        >
          <ExternalLink className="size-3.5" />
        </span>
      </div>
      {repo.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{repo.description}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {repo.language && (
          <span className="inline-flex items-center gap-1">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: langColor(repo.language) }}
            />
            {repo.language}
          </span>
        )}
        {repo.stars > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star className="size-3" />
            {repo.stars}
          </span>
        )}
        {repo.forks > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <GitFork className="size-3" />
            {repo.forks}
          </span>
        )}
        {repo.watchers > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Eye className="size-3" />
            {repo.watchers}
          </span>
        )}
        {repo.updatedAt && <span className="ml-auto">atualizado {relTime(repo.updatedAt)}</span>}
      </div>
    </div>
  );
}

function describeEvent(ev: Event): { verb: string; tail: string } {
  switch (ev.type) {
    case "PushEvent":
      return { verb: "fez push", tail: ev.ref ? `em ${ev.ref}` : "" };
    case "PullRequestEvent":
      return {
        verb: ev.action === "closed" ? "fechou PR" : ev.action === "opened" ? "abriu PR" : "atualizou PR",
        tail: ev.number ? `#${ev.number} ${ev.title}` : ev.title,
      };
    case "IssuesEvent":
      return {
        verb:
          ev.action === "closed"
            ? "fechou issue"
            : ev.action === "opened"
              ? "abriu issue"
              : "atualizou issue",
        tail: ev.number ? `#${ev.number} ${ev.title}` : ev.title,
      };
    case "IssueCommentEvent":
      return { verb: "comentou", tail: ev.number ? `#${ev.number}` : "" };
    case "WatchEvent":
      return { verb: "deu estrela", tail: "" };
    case "ForkEvent":
      return { verb: "forkou", tail: "" };
    case "CreateEvent":
      return { verb: "criou", tail: ev.ref ? `branch ${ev.ref}` : "repo" };
    case "DeleteEvent":
      return { verb: "removeu", tail: ev.ref ?? "" };
    case "ReleaseEvent":
      return { verb: "publicou release", tail: ev.title ?? "" };
    default:
      return { verb: ev.type.replace(/Event$/, ""), tail: "" };
  }
}

function EventRow({ event: ev, onOpen }: { event: Event; onOpen: (url: string) => void }) {
  const { verb, tail } = describeEvent(ev);
  const target = ev.url || ev.repoUrl;
  return (
    <li
      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/30 cursor-pointer"
      onClick={() => target && onOpen(target)}
    >
      <span className="text-xs text-muted-foreground tabular-nums w-12 shrink-0">
        {relTime(ev.createdAt)}
      </span>
      <span className="text-foreground/90">
        <span className="text-muted-foreground">{verb}</span>
        {tail && <span className="ml-1">{tail}</span>}
      </span>
      <span className="ml-auto text-xs text-muted-foreground font-mono truncate max-w-[40%]">
        {ev.repoName}
      </span>
    </li>
  );
}

function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}
