import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Play,
  RefreshCw,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { useWorkspaceConfig } from "@/hooks/useWorkspaceConfig";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { useTerminals } from "@/features/terminal/store";
import { tasksRpc } from "./rpc";
import type { TaskDef, TaskKind } from "./types";

const FAVORITES_DEFAULT: string[] = [];

interface TasksViewProps {
  rootPath: string;
  onShowTerminal?: () => void;
}

const KIND_LABEL: Record<TaskKind, string> = {
  npm: "Scripts (package.json)",
  go: "Go",
  cargo: "Cargo",
};

const KIND_ORDER: TaskKind[] = ["npm", "go", "cargo"];

export const TasksView = memo(function TasksView({ rootPath, onShowTerminal }: TasksViewProps) {
  const [tasks, setTasks] = useState<TaskDef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [running, setRunning] = useState<Set<string>>(new Set());
  // Action — identidade estável, getState evita assinar a store inteira.
  const { attach } = useTerminals.getState();
  const { value: favorites, set: setFavorites } = useWorkspaceConfig<string[]>(
    "tasks.favorites",
    FAVORITES_DEFAULT,
  );
  const favSet = useMemo(() => new Set(favorites ?? []), [favorites]);

  const toggleFavorite = useCallback(
    (taskId: string) => {
      const current = favorites ?? [];
      const next = current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId];
      void setFavorites(next).catch((err: unknown) => toast.error("Erro ao salvar favorito", err));
    },
    [favorites, setFavorites],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    setError(undefined);
    tasksRpc
      .list()
      .then(setTasks)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const off = tasksRpc.on("tasks.changed", () => refresh());
    return off;
  }, [refresh]);

  const runTask = useCallback(
    (task: TaskDef) => {
      setRunning((s) => new Set(s).add(task.id));
      tasksRpc
        .run(task.id)
        .then((sessionId) => {
          attach({
            id: sessionId,
            cwd: task.cwd,
            shell: task.command,
            title: task.label,
          });
          onShowTerminal?.();
          toast.success(`Task iniciada: ${task.label}`);
        })
        .catch((err: unknown) => toast.error("Erro ao rodar task", err))
        .finally(() =>
          setRunning((s) => {
            const next = new Set(s);
            next.delete(task.id);
            return next;
          }),
        );
    },
    [attach, onShowTerminal],
  );

  const grouped = useMemo(() => {
    const map = new Map<TaskKind, TaskDef[]>();
    for (const t of tasks) {
      const arr = map.get(t.kind) ?? [];
      arr.push(t);
      map.set(t.kind, arr);
    }
    return map;
  }, [tasks]);

  const favoriteTasks = useMemo(
    () =>
      (favorites ?? []).map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as TaskDef[],
    [favorites, tasks],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden text-sm">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
        <ListChecks className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-xs font-medium">Tasks</span>
        {loading && <Spinner className="text-muted-foreground" />}
        <button
          type="button"
          title="Atualizar"
          onClick={refresh}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar py-1">
        {!rootPath ? (
          <EmptyState icon={ListChecks} title="Abra uma pasta para detectar tasks." />
        ) : error ? (
          <EmptyState icon={AlertCircle} title={error} />
        ) : tasks.length === 0 && !loading ? (
          <EmptyState
            icon={ListChecks}
            title="Nenhuma task detectada."
            description="Suporta package.json, go.mod e Cargo.toml."
          />
        ) : (
          <>
            {favoriteTasks.length > 0 && (
              <TaskGroup
                title="Favoritos"
                tasks={favoriteTasks}
                running={running}
                favorites={favSet}
                onRun={runTask}
                onToggleFavorite={toggleFavorite}
                accent
              />
            )}
            {KIND_ORDER.map((kind) => {
              const items = grouped.get(kind);
              if (!items || items.length === 0) return null;
              return (
                <TaskGroup
                  key={kind}
                  title={KIND_LABEL[kind]}
                  tasks={items}
                  running={running}
                  favorites={favSet}
                  onRun={runTask}
                  onToggleFavorite={toggleFavorite}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
});

interface TaskGroupProps {
  title: string;
  tasks: TaskDef[];
  running: Set<string>;
  favorites: Set<string>;
  onRun: (task: TaskDef) => void;
  onToggleFavorite: (taskId: string) => void;
  accent?: boolean;
}

const TaskGroup = memo(function TaskGroup({
  title,
  tasks,
  running,
  favorites,
  onRun,
  onToggleFavorite,
  accent,
}: TaskGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-xs font-semibold hover:text-foreground",
          accent ? "text-amber-400" : "text-muted-foreground",
        )}
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        {accent && <Star className="size-3 shrink-0 fill-amber-400" />}
        <span className="flex-1 text-left uppercase tracking-wide">{title}</span>
        <span className="tabular-nums">{tasks.length}</span>
      </button>
      {open && (
        <div className="px-1">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              running={running.has(t.id)}
              favorited={favorites.has(t.id)}
              onRun={onRun}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
});

interface TaskRowProps {
  task: TaskDef;
  running: boolean;
  favorited: boolean;
  onRun: (task: TaskDef) => void;
  onToggleFavorite: (taskId: string) => void;
}

const TaskRow = memo(function TaskRow({
  task,
  running,
  favorited,
  onRun,
  onToggleFavorite,
}: TaskRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1 text-sm rounded-sm select-none hover:bg-accent/50",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-medium">{task.label}</div>
        {task.detail && (
          <div className="truncate text-[10px] text-muted-foreground">{task.detail}</div>
        )}
      </div>
      <button
        type="button"
        title={favorited ? "Remover dos favoritos" : "Favoritar"}
        onClick={() => onToggleFavorite(task.id)}
        className={cn(
          "rounded p-1 hover:bg-accent",
          favorited
            ? "text-amber-400"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-400",
        )}
      >
        <Star className={cn("size-3", favorited && "fill-amber-400")} />
      </button>
      <button
        type="button"
        title={`Rodar: ${task.command}`}
        onClick={() => onRun(task)}
        disabled={running}
        className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-50"
      >
        {running ? <Spinner className="size-3" /> : <Play className="size-3" />}
      </button>
    </div>
  );
});
