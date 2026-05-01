import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PatchDiff } from "@pierre/diffs/react";
import type { FileDiffOptions } from "@pierre/diffs";
import { useConfig } from "@/hooks/useConfig";
import {
  AlertCircle,
  Archive,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronRight,
  CircleMinus,
  CirclePlus,
  FileDiff as FileDiffIcon,
  GitBranch as GitBranchIcon,
  GitCommitHorizontal,
  History,
  LogOut,
  Minus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Undo2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { SymbolIcon } from "@/components/SymbolIcon";
import { rpc } from "./rpc";
import { GitGraph } from "./GitGraph";
import { GitHubConnect, PublishRepoDialog } from "./GitHubConnect";
import { GithubIcon } from "./GithubIcon";
import { BranchPicker } from "./BranchPicker";
import type { GitChangedFile, GitCommit, GitFileStatus, GitHubUser, GitStash } from "./types";

type DiffStyle = "unified" | "split";

const STATUS_LABEL: Record<GitFileStatus, string> = {
  modified: "M",
  added: "A",
  deleted: "D",
  renamed: "R",
  untracked: "?",
  conflicted: "!",
};

const STATUS_COLOR: Record<GitFileStatus, string> = {
  modified: "text-amber-400",
  added: "text-emerald-400",
  deleted: "text-red-400",
  renamed: "text-blue-400",
  untracked: "text-muted-foreground",
  conflicted: "text-orange-400",
};

const DIFF_OPTIONS: FileDiffOptions<undefined> = {
  diffIndicators: "bars",
  lineDiffType: "word",
  overflow: "scroll",
};

interface FileRowProps {
  file: GitChangedFile;
  selected: boolean;
  ultraFast: boolean;
  onSelect: (path: string) => void;
  onStage: (file: GitChangedFile) => void;
  onDiscard?: (path: string) => void;
}

const FileRow = memo(function FileRow({
  file,
  selected,
  ultraFast,
  onSelect,
  onStage,
  onDiscard,
}: FileRowProps) {
  const name = file.path.split("/").pop() ?? file.path;
  const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : undefined;

  return (
    <div
      onClick={() => onSelect(file.path)}
      className={cn(
        "group flex items-center gap-1.5 px-2 py-0.5 text-xs font-light cursor-pointer rounded-sm select-none",
        selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      {!ultraFast && <SymbolIcon name={name} isDir={false} className="size-4 shrink-0" />}
      <span className="flex-1 truncate min-w-0">
        <span>{name}</span>
        {dir && <span className="ml-1.5 text-[10px] text-muted-foreground">{dir}</span>}
        {file.prevPath && (
          <span className="ml-1.5 text-[10px] text-muted-foreground">
            ← {file.prevPath.split("/").pop()}
          </span>
        )}
      </span>
      <div className="flex items-center gap-0.5 shrink-0 ml-auto">
        <span
          className={cn("text-[10px] font-light tabular-nums px-0.5", STATUS_COLOR[file.status])}
          title={file.status}
        >
          {STATUS_LABEL[file.status]}
        </span>
        {onDiscard && !file.staged && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Descartar mudanças"
            onClick={(e) => {
              e.stopPropagation();
              onDiscard(file.path);
            }}
            className="text-muted-foreground/60 hover:text-destructive"
          >
            <Undo2 className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title={file.staged ? "Remover do stage" : "Adicionar ao stage"}
          onClick={(e) => {
            e.stopPropagation();
            onStage(file);
          }}
          className="text-muted-foreground/60 hover:text-primary"
        >
          {file.staged ? <Minus className="size-4" /> : <Plus className="size-4" />}
        </Button>
      </div>
    </div>
  );
});

interface FileGroupProps {
  title: string;
  files: GitChangedFile[];
  selected: string | null;
  ultraFast: boolean;
  onSelect: (path: string) => void;
  onStageFile: (file: GitChangedFile) => void;
  onDiscardFile?: (path: string) => void;
  onStageAll?: () => void;
  defaultOpen?: boolean;
  icon: React.ReactNode;
}

const FileGroup = memo(function FileGroup({
  title,
  files,
  selected,
  ultraFast,
  onSelect,
  onStageFile,
  onDiscardFile,
  onStageAll,
  defaultOpen = true,
  icon,
}: FileGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (files.length === 0) return null;

  return (
    <div className="mb-1">
      <div className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-light uppercase tracking-wide text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 min-w-0 cursor-pointer hover:text-foreground"
        >
          {open ? (
            <ChevronDown className="size-3 shrink-0" />
          ) : (
            <ChevronRight className="size-3 shrink-0" />
          )}
          {icon}
          <span className="flex-1 text-left truncate">{title}</span>
          <span className="tabular-nums">{files.length}</span>
        </button>
        {onStageAll && (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Adicionar todos ao stage"
            onClick={(e) => {
              e.stopPropagation();
              onStageAll();
            }}
            className="ml-1 hover:text-primary"
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>
      {open && (
        <div className="px-1">
          {files.map((f) => (
            <FileRow
              key={f.path}
              file={f}
              selected={selected === f.path}
              ultraFast={ultraFast}
              onSelect={onSelect}
              onStage={onStageFile}
              onDiscard={onDiscardFile}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const CommitsGroup = memo(function CommitsGroup({ commits }: { commits: GitCommit[] }) {
  const [open, setOpen] = useState(false);

  if (commits.length === 0) return null;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-light uppercase tracking-wide text-muted-foreground hover:text-foreground cursor-pointer"
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <History className="size-3 shrink-0" />
        <span className="flex-1 text-left">Commits</span>
        <span className="tabular-nums">{commits.length}</span>
      </button>
      {open && (
        <div className="px-1">
          {commits.map((c) => (
            <div
              key={c.hash}
              className="flex items-start gap-1.5 px-2 py-1 text-[11px] font-light select-none rounded-sm hover:bg-accent/40"
            >
              <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0 pt-0.5 w-12">
                {c.shortHash}
              </span>
              <span className="flex-1 truncate">{c.message}</span>
              <span className="text-[10px] text-muted-foreground/50 shrink-0 ml-1 whitespace-nowrap">
                {c.date}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

interface GitViewProps {
  compact?: boolean;
  onOpenFile?: (path: string) => void;
  rootPath?: string;
}

export const GitView = memo(function GitView({
  compact = false,
  onOpenFile,
  rootPath,
}: GitViewProps = {}) {
  const { value: ultraFast } = useConfig<boolean>("performance.ultraFast", false);
  const [files, setFiles] = useState<GitChangedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedStaged, setSelectedStaged] = useState(false);
  const [patch, setPatch] = useState<string | undefined>();
  const [patchLoading, setPatchLoading] = useState(false);
  const [diffStyle, setDiffStyle] = useState<DiffStyle>("split");
  const [commitMsg, setCommitMsg] = useState("");
  const [committing, setCommitting] = useState(false);
  const [justCommitted, setJustCommitted] = useState(false);
  const [branch, setBranch] = useState("");
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [stashes, setStashes] = useState<GitStash[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [hasOrigin, setHasOrigin] = useState(false);
  const [ghUser, setGhUser] = useState<GitHubUser | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Esc + click-outside fecham o menu de ações git. Identificamos
  // menu/trigger por data-attribute pra suportar os dois modos (compact
  // e full) sem refs duplicados.
  useEffect(() => {
    if (!showMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMenu(false);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest("[data-git-menu]")) return;
      if (target.closest("[data-git-menu-trigger]")) return;
      setShowMenu(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [showMenu]);

  const refresh = useCallback(() => {
    rpc.git
      .isRepo()
      .then((repo) => {
        setIsRepo(repo);
        if (!repo) {
          setFiles([]);
          setBranch("");
          setCommits([]);
          return;
        }
        setLoading(true);
        setError(undefined);
        rpc.git
          .status()
          .then((result) => setFiles(result))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
          .finally(() => setLoading(false));
        rpc.git
          .getBranch()
          .then(setBranch)
          .catch(() => {});
        rpc.git
          .getLog(20)
          .then(setCommits)
          .catch(() => {});
        rpc.git
          .listBranches()
          .then((bs) => setBranches(bs.map((b) => b.name)))
          .catch(() => {});
        rpc.git
          .stashList()
          .then(setStashes)
          .catch(() => {});
        rpc.git
          .listRemotes()
          .then((rs) => setHasOrigin(rs.some((r) => r.name === "origin")))
          .catch(() => setHasOrigin(false));
      })
      .catch(() => setIsRepo(false));
  }, []);

  const refreshGitHub = useCallback(() => {
    rpc.github
      .isAuthenticated()
      .then((auth) => {
        if (!auth) {
          setGhUser(null);
          return;
        }
        rpc.github
          .getUser()
          .then(setGhUser)
          .catch(() => setGhUser(null));
      })
      .catch(() => setGhUser(null));
  }, []);

  useEffect(() => {
    refreshGitHub();
    const off = rpc.on("github.changed", () => refreshGitHub());
    return off;
  }, [refreshGitHub]);

  const onGitHubClick = useCallback(() => {
    if (!ghUser) {
      setShowConnect(true);
      return;
    }
    setShowPublish(true);
  }, [ghUser]);

  const logoutGitHub = useCallback(() => {
    rpc.github
      .logout()
      .then(() => {
        setGhUser(null);
        toast.success("Desconectado do GitHub");
      })
      .catch((err: unknown) => toast.error("Erro ao desconectar", err));
  }, []);

  const initRepo = useCallback(() => {
    setInitializing(true);
    rpc.git
      .init()
      .then(() => {
        toast.success("Repositório inicializado");
        refresh();
      })
      .catch((err: unknown) => toast.error("Erro ao inicializar repositório", err))
      .finally(() => setInitializing(false));
  }, [refresh]);

  const pull = useCallback(() => {
    setSyncing(true);
    rpc.git
      .pull()
      .then(() => toast.success("Pull realizado"))
      .catch((err: unknown) => toast.error("Erro ao fazer pull", err))
      .finally(() => setSyncing(false));
  }, []);

  const switchBranch = useCallback(
    (name: string) => {
      rpc.git
        .checkoutBranch(name)
        .then(() => {
          toast.success(`Branch alterada para ${name}`);
          refresh();
        })
        .catch((err: unknown) => toast.error("Erro ao trocar de branch", err));
    },
    [refresh],
  );

  const createBranch = useCallback(
    (name: string) => {
      rpc.git
        .createBranch(name)
        .then(() => rpc.git.checkoutBranch(name))
        .then(() => {
          toast.success(`Branch ${name} criada`);
          refresh();
        })
        .catch((err: unknown) => toast.error("Erro ao criar branch", err));
    },
    [refresh],
  );

  const push = useCallback(() => {
    setJustCommitted(false);
    setSyncing(true);
    rpc.git
      .push()
      .then(() => toast.success("Push realizado"))
      .catch((err: unknown) => toast.error("Erro ao fazer push", err))
      .finally(() => setSyncing(false));
  }, []);

  useEffect(() => {
    refresh();
    const off = rpc.on("git.changed", () => refresh());
    return off;
  }, [refresh]);

  const selectFile = useCallback(
    (path: string, staged: boolean) => {
      setSelectedPath(path);
      setSelectedStaged(staged);
      if (compact) {
        onOpenFile?.(path);
        return;
      }
      abortRef.current?.abort();
      setPatch(undefined);
      setPatchLoading(true);
      rpc.git
        .diff(path, staged)
        .then((p) => {
          setPatch(p);
        })
        .catch(() => {
          setPatch(undefined);
        })
        .finally(() => {
          setPatchLoading(false);
        });
    },
    [compact, onOpenFile],
  );

  const stageFile = useCallback((file: GitChangedFile) => {
    const op = file.staged ? rpc.git.unstage(file.path) : rpc.git.stage(file.path);
    op.catch((err: unknown) => {
      toast.error("Erro ao alterar stage", err);
    });
  }, []);

  const discardFile = useCallback((path: string) => {
    rpc.git.discardFile(path).catch((err: unknown) => {
      toast.error("Erro ao descartar mudanças", err);
    });
  }, []);

  const stageAll = useCallback(() => {
    rpc.git.stageAll().catch((err: unknown) => {
      toast.error("Erro ao adicionar tudo ao stage", err);
    });
  }, []);

  const commit = useCallback(() => {
    if (!commitMsg.trim()) return;
    setCommitting(true);
    rpc.git
      .commit(commitMsg.trim())
      .then(() => {
        setCommitMsg("");
        refresh();
        toast.success("Commit realizado");
        setJustCommitted(true);
      })
      .catch((err: unknown) => {
        toast.error("Erro ao fazer commit", err);
      })
      .finally(() => {
        setCommitting(false);
      });
  }, [commitMsg, refresh]);

  const { staged, unstaged } = useMemo(() => {
    const s: GitChangedFile[] = [];
    const u: GitChangedFile[] = [];
    for (const f of files) (f.staged ? s : u).push(f);
    return { staged: s, unstaged: u };
  }, [files]);

  const selectStaged = useCallback((p: string) => selectFile(p, true), [selectFile]);
  const selectUnstaged = useCallback((p: string) => selectFile(p, false), [selectFile]);

  const defaultRepoName = rootPath ? (rootPath.split("/").filter(Boolean).pop() ?? "") : "";

  const ghButtonTitle = ghUser
    ? hasOrigin
      ? `@${ghUser.login} — publicar de novo`
      : `@${ghUser.login} — publicar repositório`
    : "Conectar ao GitHub";

  const githubMenuItems = ghUser ? (
    <>
      <div className="border-t border-border/40 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
        GitHub
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5">
        {ghUser.avatarUrl ? (
          <img src={ghUser.avatarUrl} alt={ghUser.login} className="size-5 rounded-full" />
        ) : (
          <GithubIcon className="size-4" />
        )}
        <span className="flex-1 truncate text-xs">@{ghUser.login}</span>
        <button
          type="button"
          title="Desconectar"
          onClick={() => {
            logoutGitHub();
            setShowMenu(false);
          }}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
        >
          <LogOut className="size-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          EventsEmit("commandCenter.exec", "openGitHubProfile");
          setShowMenu(false);
        }}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
      >
        <UserIcon className="size-3.5" />
        Ver perfil do GitHub
      </button>
      <button
        type="button"
        onClick={() => {
          setShowPublish(true);
          setShowMenu(false);
        }}
        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
      >
        <Upload className="size-3.5" />
        {hasOrigin ? "Publicar como novo repositório" : "Publicar no GitHub"}
      </button>
    </>
  ) : null;

  const diffOptions: FileDiffOptions<undefined> = useMemo(
    () => ({
      ...DIFF_OPTIONS,
      diffStyle,
    }),
    [diffStyle],
  );

  if (compact) {
    return (
      <div className="flex h-full flex-col overflow-hidden text-sm">
        <div className="relative flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
          <button
            type="button"
            title="Trocar de branch"
            data-branch-trigger="true"
            onClick={() => isRepo !== false && setShowBranchPicker((v) => !v)}
            disabled={isRepo === false}
            className="flex flex-1 items-center gap-1.5 min-w-0 rounded px-1 py-0.5 hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left text-xs font-medium">{branch || "—"}</span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </button>
          {(loading || syncing) && <Spinner className="text-muted-foreground" />}
          <button
            type="button"
            title="Pull"
            onClick={pull}
            disabled={syncing}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
          >
            <ArrowDownToLine className="size-3.5" />
          </button>
          <button
            type="button"
            title="Push"
            onClick={push}
            disabled={syncing}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
          >
            <ArrowUpToLine className="size-3.5" />
          </button>
          <button
            type="button"
            title="Atualizar"
            onClick={refresh}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            title={ghButtonTitle}
            onClick={onGitHubClick}
            className={cn(
              "rounded p-1 hover:bg-accent",
              ghUser
                ? "text-emerald-400 hover:text-emerald-300"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <GithubIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Menu git"
            data-git-menu-trigger="true"
            onClick={() => setShowMenu((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
          {showBranchPicker && (
            <BranchPicker
              current={branch}
              branches={branches}
              onCheckout={switchBranch}
              onCreate={createBranch}
              onClose={() => setShowBranchPicker(false)}
            />
          )}
        </div>

        {showMenu && (
          <div
            data-git-menu="true"
            className="border-b border-border/60 bg-popover text-popover-foreground shadow-sm text-xs"
          >
            <button
              type="button"
              onClick={() => {
                setShowGraph(true);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <GitBranchIcon className="size-3.5" /> Ver grafo do repositório
            </button>
            <button
              type="button"
              onClick={() => {
                rpc.git
                  .undoLastCommit()
                  .then(refresh)
                  .catch((e: unknown) => toast.error("Erro", e));
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <RotateCcw className="size-3.5" /> Desfazer último commit
            </button>
            <button
              type="button"
              onClick={() => {
                rpc.git
                  .stashSave("")
                  .then(refresh)
                  .catch((e: unknown) => toast.error("Erro", e));
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <Archive className="size-3.5" /> Guardar mudanças (stash)
            </button>
            {stashes.length > 0 && (
              <div className="border-t border-border/40 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                Stashes ({stashes.length})
              </div>
            )}
            {stashes.map((s) => (
              <div key={s.index} className="flex items-center gap-1 px-3 py-1.5 hover:bg-accent/50">
                <span className="flex-1 truncate">{s.message || `stash@{${s.index}}`}</span>
                <button
                  type="button"
                  title="Aplicar"
                  onClick={() => {
                    rpc.git
                      .stashPop(s.index)
                      .then(refresh)
                      .catch((e: unknown) => toast.error("Erro", e));
                    setShowMenu(false);
                  }}
                  className="rounded p-0.5 hover:text-primary text-muted-foreground"
                >
                  <RotateCcw className="size-3" />
                </button>
                <button
                  type="button"
                  title="Descartar"
                  onClick={() => {
                    rpc.git
                      .stashDrop(s.index)
                      .then(refresh)
                      .catch((e: unknown) => toast.error("Erro", e));
                    setShowMenu(false);
                  }}
                  className="rounded p-0.5 hover:text-destructive text-muted-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {branches.length > 0 && (
              <>
                <div className="border-t border-border/40 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  Branches
                </div>
                {branches.slice(0, 8).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      rpc.git
                        .checkoutBranch(b)
                        .then(refresh)
                        .catch((e: unknown) => toast.error("Erro", e));
                      setShowMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left",
                      b === branch && "text-primary font-medium",
                    )}
                  >
                    <GitBranchIcon className="size-3 shrink-0" />
                    <span className="truncate">{b}</span>
                  </button>
                ))}
              </>
            )}
            {githubMenuItems}
          </div>
        )}

        {isRepo !== false && (
          <div className="border-b border-border/60 p-2 flex flex-col gap-2">
            <Textarea
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder={
                staged.length > 0 ? "Mensagem (Ctrl+Enter)" : "Stage arquivos para commitar"
              }
              disabled={staged.length === 0}
              rows={2}
              className="resize-none min-h-0 px-2 py-1.5 text-xs"
            />
            <Button
              size="sm"
              onClick={commit}
              disabled={!commitMsg.trim() || staged.length === 0 || committing}
              className="w-full justify-center gap-1.5"
            >
              {committing ? <Spinner /> : <GitCommitHorizontal className="size-3.5" />}
              Commit{staged.length > 0 ? ` (${staged.length})` : ""}
            </Button>
          </div>
        )}

        {justCommitted && hasOrigin && (
          <div className="border-b border-border/60 p-2">
            <Button
              size="sm"
              onClick={push}
              disabled={syncing}
              className="w-full justify-center gap-1.5"
            >
              {syncing ? <Spinner /> : <ArrowUpToLine className="size-3.5" />}
              Publicar no remoto (Push)
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar py-1 pr-2">
          {isRepo === false ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <GitBranchIcon className="size-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">
                {rootPath
                  ? "A pasta não é um repositório git."
                  : "Abra uma pasta para usar o controle de versão."}
              </p>
              {rootPath && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={initRepo}
                  disabled={initializing}
                  className="gap-1.5"
                >
                  {initializing ? <Spinner /> : <Plus className="size-3.5" />}
                  Inicializar repositório
                </Button>
              )}
            </div>
          ) : error ? (
            <EmptyState icon={AlertCircle} title={error} />
          ) : files.length === 0 && !loading ? (
            <EmptyState icon={Check} title="Sem mudanças pendentes." />
          ) : (
            <>
              <FileGroup
                title="Staged"
                files={staged}
                selected={selectedStaged ? selectedPath : null}
                ultraFast={ultraFast}
                onSelect={selectStaged}
                onStageFile={stageFile}
                icon={<CircleMinus className="size-3" />}
                defaultOpen
              />
              <FileGroup
                title="Mudanças"
                files={unstaged}
                selected={!selectedStaged ? selectedPath : null}
                ultraFast={ultraFast}
                onSelect={selectUnstaged}
                onStageFile={stageFile}
                onDiscardFile={discardFile}
                onStageAll={unstaged.length > 0 ? stageAll : undefined}
                icon={<CirclePlus className="size-3" />}
                defaultOpen
              />
              <CommitsGroup commits={commits} />
            </>
          )}
        </div>
        {showGraph && <GitGraph onClose={() => setShowGraph(false)} />}
        <GitHubConnect
          open={showConnect}
          onOpenChange={setShowConnect}
          onAuthenticated={(u) => setGhUser(u)}
        />
        <PublishRepoDialog
          open={showPublish}
          onOpenChange={setShowPublish}
          defaultName={defaultRepoName}
          onPublished={() => {
            setHasOrigin(true);
            refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border/60 overflow-hidden">
        {/* Toolbar */}
        <div className="relative flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
          <button
            type="button"
            title="Trocar de branch"
            data-branch-trigger="true"
            onClick={() => isRepo !== false && setShowBranchPicker((v) => !v)}
            disabled={isRepo === false}
            className="flex flex-1 items-center gap-1.5 min-w-0 rounded px-1 py-0.5 hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <GitBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-left text-xs font-medium">{branch || "—"}</span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          </button>
          {(loading || syncing) && <Spinner className="text-muted-foreground" />}
          <button
            type="button"
            title="Pull"
            onClick={pull}
            disabled={syncing}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
          >
            <ArrowDownToLine className="size-3.5" />
          </button>
          <button
            type="button"
            title="Push"
            onClick={push}
            disabled={syncing}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40"
          >
            <ArrowUpToLine className="size-3.5" />
          </button>
          <button
            type="button"
            title="Atualizar"
            onClick={refresh}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            title={ghButtonTitle}
            onClick={onGitHubClick}
            className={cn(
              "rounded p-1 hover:bg-accent",
              ghUser
                ? "text-emerald-400 hover:text-emerald-300"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <GithubIcon className="size-3.5" />
          </button>
          <button
            type="button"
            title="Menu git"
            data-git-menu-trigger="true"
            onClick={() => setShowMenu((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
          {showBranchPicker && (
            <BranchPicker
              current={branch}
              branches={branches}
              onCheckout={switchBranch}
              onCreate={createBranch}
              onClose={() => setShowBranchPicker(false)}
            />
          )}
        </div>

        {showMenu && (
          <div
            data-git-menu="true"
            className="border-b border-border/60 bg-popover text-popover-foreground shadow-sm text-xs"
          >
            <button
              type="button"
              onClick={() => {
                setShowGraph(true);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <GitBranchIcon className="size-3.5" /> Ver grafo do repositório
            </button>
            <button
              type="button"
              onClick={() => {
                rpc.git
                  .undoLastCommit()
                  .then(refresh)
                  .catch((e: unknown) => toast.error("Erro", e));
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <RotateCcw className="size-3.5" /> Desfazer último commit
            </button>
            <button
              type="button"
              onClick={() => {
                rpc.git
                  .stashSave("")
                  .then(refresh)
                  .catch((e: unknown) => toast.error("Erro", e));
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 hover:bg-accent"
            >
              <Archive className="size-3.5" /> Guardar mudanças (stash)
            </button>
            {stashes.length > 0 && (
              <div className="border-t border-border/40 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                Stashes ({stashes.length})
              </div>
            )}
            {stashes.map((s) => (
              <div key={s.index} className="flex items-center gap-1 px-3 py-1.5 hover:bg-accent/50">
                <span className="flex-1 truncate">{s.message || `stash@{${s.index}}`}</span>
                <button
                  type="button"
                  title="Aplicar"
                  onClick={() => {
                    rpc.git
                      .stashPop(s.index)
                      .then(refresh)
                      .catch((e: unknown) => toast.error("Erro", e));
                    setShowMenu(false);
                  }}
                  className="rounded p-0.5 hover:text-primary text-muted-foreground"
                >
                  <RotateCcw className="size-3" />
                </button>
                <button
                  type="button"
                  title="Descartar"
                  onClick={() => {
                    rpc.git
                      .stashDrop(s.index)
                      .then(refresh)
                      .catch((e: unknown) => toast.error("Erro", e));
                    setShowMenu(false);
                  }}
                  className="rounded p-0.5 hover:text-destructive text-muted-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {branches.length > 0 && (
              <>
                <div className="border-t border-border/40 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                  Branches
                </div>
                {branches.slice(0, 8).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      rpc.git
                        .checkoutBranch(b)
                        .then(refresh)
                        .catch((e: unknown) => toast.error("Erro", e));
                      setShowMenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 hover:bg-accent text-left",
                      b === branch && "text-primary font-medium",
                    )}
                  >
                    <GitBranchIcon className="size-3 shrink-0" />
                    <span className="truncate">{b}</span>
                  </button>
                ))}
              </>
            )}
            {githubMenuItems}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto scrollbar py-1 pr-2">
          {isRepo === false ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <GitBranchIcon className="size-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">
                {rootPath
                  ? "A pasta não é um repositório git."
                  : "Abra uma pasta para usar o controle de versão."}
              </p>
              {rootPath && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={initRepo}
                  disabled={initializing}
                  className="gap-1.5"
                >
                  {initializing ? <Spinner /> : <Plus className="size-3.5" />}
                  Inicializar repositório
                </Button>
              )}
            </div>
          ) : error ? (
            <EmptyState icon={AlertCircle} title={error} />
          ) : files.length === 0 && !loading ? (
            <EmptyState icon={Check} title="Sem mudanças pendentes." />
          ) : (
            <>
              <FileGroup
                title="Staged"
                files={staged}
                selected={selectedStaged ? selectedPath : null}
                ultraFast={ultraFast}
                onSelect={selectStaged}
                onStageFile={stageFile}
                icon={<CircleMinus className="size-3" />}
                defaultOpen
              />
              <FileGroup
                title="Mudanças"
                files={unstaged}
                selected={!selectedStaged ? selectedPath : null}
                ultraFast={ultraFast}
                onSelect={selectUnstaged}
                onStageFile={stageFile}
                onDiscardFile={discardFile}
                onStageAll={unstaged.length > 0 ? stageAll : undefined}
                icon={<CirclePlus className="size-3" />}
                defaultOpen
              />
              <CommitsGroup commits={commits} />
            </>
          )}
        </div>

        {/* Commit area */}
        {isRepo !== false && (
          <div className="border-t border-border/60 p-2 flex flex-col gap-2">
            <Textarea
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder={
                staged.length > 0
                  ? "Mensagem do commit (Ctrl+Enter)"
                  : "Faça stage de arquivos para commitar"
              }
              disabled={staged.length === 0}
              rows={3}
              className="resize-none min-h-0 px-2 py-1.5 text-xs"
            />
            <Button
              size="sm"
              onClick={commit}
              disabled={!commitMsg.trim() || staged.length === 0 || committing}
              className="w-full justify-center gap-1.5"
            >
              {committing ? <Spinner /> : <GitCommitHorizontal className="size-3.5" />}
              Commit{staged.length > 0 ? ` (${staged.length})` : ""}
            </Button>
          </div>
        )}

        {justCommitted && hasOrigin && (
          <div className="border-b border-border/60 p-2">
            <Button
              size="sm"
              onClick={push}
              disabled={syncing}
              className="w-full justify-center gap-1.5"
            >
              {syncing ? <Spinner /> : <ArrowUpToLine className="size-3.5" />}
              Publicar no remoto (Push)
            </Button>
          </div>
        )}
      </div>

      {/* Diff panel */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Diff toolbar */}
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
          {selectedPath ? (
            <>
              <FileDiffIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {selectedStaged ? (
                  <span className="mr-1.5 text-[10px] font-semibold text-emerald-400">STAGED</span>
                ) : (
                  <span className="mr-1.5 text-[10px] font-semibold text-amber-400">UNSTAGED</span>
                )}
                {selectedPath}
              </span>
            </>
          ) : (
            <span className="flex-1 text-xs text-muted-foreground">
              Selecione um arquivo para ver o diff
            </span>
          )}

          {/* Split / unified toggle */}
          <div className="flex rounded-md border border-border/60 text-[10px] overflow-hidden">
            {(["unified", "split"] as DiffStyle[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDiffStyle(s)}
                className={cn(
                  "px-2 py-0.5 capitalize",
                  diffStyle === s
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto">
          {patchLoading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" className="text-muted-foreground" />
            </div>
          ) : patch ? (
            <PatchDiff patch={patch} options={diffOptions} style={{ height: "100%" }} />
          ) : (
            <EmptyState
              icon={FileDiffIcon}
              title={
                selectedPath
                  ? "Diff não disponível para este arquivo."
                  : "Nenhum arquivo selecionado."
              }
              className="h-full"
            />
          )}
        </div>
      </div>
      {showGraph && <GitGraph onClose={() => setShowGraph(false)} />}
      <GitHubConnect
        open={showConnect}
        onOpenChange={setShowConnect}
        onAuthenticated={(u) => setGhUser(u)}
      />
      <PublishRepoDialog
        open={showPublish}
        onOpenChange={setShowPublish}
        defaultName={defaultRepoName}
        onPublished={() => {
          setHasOrigin(true);
          refresh();
        }}
      />
    </div>
  );
});
