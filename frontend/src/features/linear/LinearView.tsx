import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Info,
  LogOut,
  RefreshCw,
  SquareCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { linearRpc, type LinearIssue, type LinearUser } from "./rpc";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<number, string> = {
  0: "Sem prioridade",
  1: "Urgente",
  2: "Alta",
  3: "Média",
  4: "Baixa",
};

const PRIORITY_COLOR: Record<number, string> = {
  0: "text-muted-foreground",
  1: "text-red-400",
  2: "text-orange-400",
  3: "text-yellow-400",
  4: "text-blue-400",
};

function PriorityDot({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    0: "bg-muted-foreground/30",
    1: "bg-red-500",
    2: "bg-orange-500",
    3: "bg-yellow-500",
    4: "bg-blue-500",
  };
  return (
    <span
      className={cn("inline-block size-2 rounded-full shrink-0", colors[priority] ?? colors[0])}
      title={PRIORITY_LABEL[priority] ?? ""}
    />
  );
}

function StateBadge({ state }: { state: LinearIssue["state"] }) {
  const typeClass: Record<string, string> = {
    backlog: "text-muted-foreground border-border/60",
    unstarted: "text-muted-foreground border-border/60",
    started: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    completed: "text-green-400 border-green-500/30 bg-green-500/10",
    cancelled: "text-muted-foreground/50 border-border/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
        typeClass[state.type] ?? "text-muted-foreground border-border/60",
      )}
    >
      <span
        className="inline-block size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: state.color || undefined }}
      />
      {state.name}
    </span>
  );
}

function relTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  return `${mo}mo`;
}

// ── Issue row ─────────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: LinearIssue }) {
  const openUrl = useCallback(() => {
    window.open(issue.url, "_blank");
  }, [issue.url]);

  return (
    <button
      type="button"
      onClick={openUrl}
      className="group w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 border-b border-border/20 last:border-0 cursor-pointer"
      title={`Abrir ${issue.identifier} no Linear`}
    >
      <PriorityDot priority={issue.priority} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {issue.identifier}
          </span>
          <StateBadge state={issue.state} />
          {issue.project && (
            <span
              className="text-[10px] text-muted-foreground truncate"
              style={{ color: issue.project.color || undefined }}
            >
              {issue.project.name}
            </span>
          )}
        </div>
        <p className="text-xs font-medium leading-snug truncate">{issue.title}</p>
        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
          <span>{issue.team.name}</span>
          {issue.dueDate && (
            <>
              <span>·</span>
              <span className={cn(new Date(issue.dueDate) < new Date() && "text-red-400")}>
                vence {new Date(issue.dueDate).toLocaleDateString("pt-BR")}
              </span>
            </>
          )}
          <span className="ml-auto">{relTime(issue.updatedAt)}</span>
        </div>
      </div>
      <ArrowUpRight className="size-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity mt-0.5" />
    </button>
  );
}

// ── Issue group ───────────────────────────────────────────────────────────────

function IssueGroup({
  title,
  issues,
  defaultOpen = true,
}: {
  title: string;
  issues: LinearIssue[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="flex-1 text-left">{title}</span>
        <span className="tabular-nums">{issues.length}</span>
      </button>
      {open && (
        <div>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Setup screen ──────────────────────────────────────────────────────────────

function SetupScreen({
  onSaved,
}: {
  onSaved: (clientId: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const id = clientId.trim();
    if (!id) return;
    setSaving(true);
    try {
      await linearRpc.setClientId(id);
      onSaved(id);
    } catch (e: unknown) {
      toast.error("Erro ao salvar Client ID", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <SquareCheck className="size-10 mx-auto text-violet-400 mb-3" />
          <h2 className="text-sm font-semibold">Conectar com Linear</h2>
          <p className="text-xs text-muted-foreground">
            Para autorizar o Adila IDE, crie um OAuth App no Linear e cole o Client ID abaixo.
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-2">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 mt-0.5 text-blue-400" />
            <div className="space-y-1">
              <p>
                <strong className="text-foreground">1.</strong> Acesse{" "}
                <span className="font-mono text-[10px] bg-muted/40 px-1 rounded">
                  linear.app/settings/api
                </span>
              </p>
              <p>
                <strong className="text-foreground">2.</strong> Clique em{" "}
                <em>"OAuth applications" → "Create new"</em>
              </p>
              <p>
                <strong className="text-foreground">3.</strong> Defina o Redirect URI como:
              </p>
              <p className="font-mono text-[10px] bg-muted/40 px-2 py-1 rounded select-all">
                http://localhost:19281/callback
              </p>
              <p>
                <strong className="text-foreground">4.</strong> Copie o <em>Client ID</em> e cole
                abaixo.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="lin_client_..."
            className="w-full rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
          />
        </div>

        <Button
          className="w-full"
          onClick={() => void handleSave()}
          disabled={!clientId.trim() || saving}
        >
          {saving ? <Spinner className="size-3.5 mr-2" /> : null}
          Salvar e continuar
        </Button>
      </div>
    </div>
  );
}

// ── Connect screen ────────────────────────────────────────────────────────────

function ConnectScreen({ onConnected }: { onConnected: () => void }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await linearRpc.startOAuth();
      onConnected();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="w-full max-w-sm space-y-5 text-center">
        <SquareCheck className="size-10 mx-auto text-violet-400" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Linear</h2>
          <p className="text-xs text-muted-foreground">
            Veja as issues atribuídas a você diretamente no IDE.
          </p>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive text-left">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <Button
          className="w-full gap-2"
          onClick={() => void handleConnect()}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <Spinner className="size-3.5" />
              Aguardando autorização…
            </>
          ) : (
            <>
              <SquareCheck className="size-4" />
              Entrar com Linear
            </>
          )}
        </Button>
        {connecting && (
          <p className="text-[11px] text-muted-foreground">
            O browser foi aberto — autorize o app e volte aqui.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type Props = {
  overlayOpen?: boolean;
  onClose?: () => void;
};

type Screen = "loading" | "setup" | "connect" | "issues";

export function LinearView({ overlayOpen, onClose }: Props = {}) {
  if (overlayOpen === false) return null;
  const [screen, setScreen] = useState<Screen>("loading");
  const [me, setMe] = useState<LinearUser | null>(null);
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "started" | "urgent">("all");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const determineScreen = useCallback(async () => {
    try {
      const authed = await linearRpc.isAuthenticated();
      if (!mounted.current) return;
      setScreen(authed ? "issues" : "connect");
    } catch {
      if (mounted.current) setScreen("connect");
    }
  }, []);

  useEffect(() => {
    void determineScreen();
    const off = linearRpc.onAuthed(() => {
      if (mounted.current) setScreen("issues");
    });
    return () => off();
  }, [determineScreen]);

  const fetchIssues = useCallback(async () => {
    setLoadingIssues(true);
    setError(null);
    try {
      const [user, list] = await Promise.all([linearRpc.getMe(), linearRpc.getMyIssues()]);
      if (!mounted.current) return;
      setMe(user);
      setIssues(list ?? []);
    } catch (e: unknown) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setLoadingIssues(false);
    }
  }, []);

  useEffect(() => {
    if (screen === "issues") void fetchIssues();
  }, [screen, fetchIssues]);

  const handleLogout = async () => {
    try {
      await linearRpc.logout();
      setMe(null);
      setIssues([]);
      setScreen("connect");
    } catch (e: unknown) {
      toast.error("Erro ao desconectar", e);
    }
  };

  // ── Filter issues
  const filtered = issues.filter((i) => {
    if (filter === "started") return i.state.type === "started";
    if (filter === "urgent") return i.priority === 1;
    return true;
  });

  // ── Group by team
  const grouped = filtered.reduce<Record<string, LinearIssue[]>>((acc, i) => {
    const key = i.team.name;
    (acc[key] ??= []).push(i);
    return acc;
  }, {});

  const priorityOrder = [1, 2, 3, 4, 0];
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
    );
  }

  const teamNames = Object.keys(grouped).sort();

  // ── Render ─────────────────────────────────────────────────────────────────

  if (screen === "loading") {
    return (
      <div className="fixed inset-0 z-40 bg-background flex items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  if (screen === "setup") {
    return (
      <div className="fixed inset-0 z-40 bg-background flex flex-col">
        <ViewHeader me={null} onClose={onClose} onLogout={undefined} onRefresh={undefined} />
        <SetupScreen onSaved={() => setScreen("connect")} />
      </div>
    );
  }

  if (screen === "connect") {
    return (
      <div className="fixed inset-0 z-40 bg-background flex flex-col">
        <ViewHeader me={null} onClose={onClose} onLogout={undefined} onRefresh={undefined} />
        <ConnectScreen onConnected={() => setScreen("issues")} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <ViewHeader
        me={me}
        onClose={onClose}
        onLogout={() => void handleLogout()}
        onRefresh={() => void fetchIssues()}
        loading={loadingIssues}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-1 border-b border-border/60 px-4 py-2">
        {(["all", "started", "urgent"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
              filter === f
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? `Todas (${issues.length})` : f === "started" ? "Em andamento" : "Urgentes"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto scrollbar">
        {error ? (
          <div className="flex items-start gap-2 m-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : loadingIssues ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={filter === "all" ? "Nenhuma issue atribuída" : "Nenhuma issue neste filtro"}
            description={
              filter === "all"
                ? "Issues atribuídas a você no Linear aparecem aqui."
                : "Tente outro filtro."
            }
          />
        ) : (
          <div>
            {teamNames.map((team) => (
              <IssueGroup key={team} title={team} issues={grouped[team]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function ViewHeader({
  me,
  onClose,
  onLogout,
  onRefresh,
  loading,
}: {
  me: LinearUser | null;
  onClose?: () => void;
  onLogout?: () => void;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border/60 px-5 py-3 shrink-0">
      <SquareCheck className="size-4 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm font-semibold">Linear</span>
        {me && (
          <div className="flex items-center gap-1.5">
            {me.avatarUrl ? (
              <img
                src={me.avatarUrl}
                alt={me.displayName || me.name}
                className="size-5 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <span className="size-5 rounded-full bg-violet-500/20 inline-flex items-center justify-center text-[9px] font-semibold text-violet-400">
                {(me.displayName || me.name)?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{me.displayName || me.name}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Atualizar"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150 active:scale-90"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Desconectar"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-150 active:scale-95"
          >
            <LogOut className="size-3.5" />
            Desconectar
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150 active:scale-90"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </header>
  );
}
