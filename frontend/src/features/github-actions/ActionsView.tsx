import { memo, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleX,
  Loader2,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { LogViewer } from "./LogViewer";
import type { GitHubJob, GitHubWorkflowRun } from "./types";
import { ACTIVE_STATUSES } from "./types";
import { useActionsStream } from "./useActionsStream";

export const ActionsView = memo(function ActionsView() {
  const stream = useActionsStream();
  const [openRun, setOpenRun] = useState<number | null>(null);
  const [openJob, setOpenJob] = useState<number | null>(null);

  // Inicia watcher uma vez quando o painel monta.
  useEffect(() => {
    stream.start();
    return () => {
      stream.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onToggleRun = (run: GitHubWorkflowRun) => {
    if (openRun === run.id) {
      setOpenRun(null);
      setOpenJob(null);
      return;
    }
    setOpenRun(run.id);
    setOpenJob(null);
    if (!stream.jobsByRun.has(run.id)) {
      stream.loadJobs(run.id);
    }
  };

  const onSelectJob = (job: GitHubJob) => {
    if (openJob === job.id) {
      setOpenJob(null);
      return;
    }
    setOpenJob(job.id);
    stream.focusJob(job.id);
  };

  if (stream.error) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        <div className="text-destructive mb-2">{stream.error}</div>
        <button
          className="px-2 py-1 border rounded hover:bg-accent"
          onClick={() => stream.start()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center justify-between px-2 py-1.5 border-b shrink-0">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {stream.status.watching ? (
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          ) : (
            <span className="size-1.5 rounded-full bg-muted" />
          )}
          <span className="truncate">
            {stream.status.owner && stream.status.repo
              ? `${stream.status.owner}/${stream.status.repo}`
              : "GitHub Actions"}
          </span>
        </div>
        <button
          className="p-1 hover:bg-accent rounded text-muted-foreground"
          onClick={() => stream.refresh()}
          title="Atualizar"
        >
          <RefreshCw className={"size-3 " + (stream.loading ? "animate-spin" : "")} />
        </button>
      </div>

      <div className={"flex-1 min-h-0 " + (openJob != null ? "flex flex-col" : "overflow-auto")}>
        <div className={openJob != null ? "h-1/2 overflow-auto border-b" : ""}>
          {stream.runs.length === 0 ? (
            <div className="p-3 text-muted-foreground">
              {stream.loading ? "Carregando runs…" : "Nenhum workflow run encontrado."}
            </div>
          ) : (
            <ul>
              {stream.runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  expanded={openRun === run.id}
                  jobs={stream.jobsByRun.get(run.id)}
                  selectedJobId={openJob}
                  onToggle={() => onToggleRun(run)}
                  onSelectJob={onSelectJob}
                />
              ))}
            </ul>
          )}
        </div>

        {openJob != null && (
          <div className="flex-1 min-h-0">
            <LogViewer
              text={stream.logs.get(openJob)?.text ?? ""}
              done={stream.logs.get(openJob)?.done ?? false}
            />
          </div>
        )}
      </div>
    </div>
  );
});

const RunRow = memo(function RunRow({
  run,
  expanded,
  jobs,
  selectedJobId,
  onToggle,
  onSelectJob,
}: {
  run: GitHubWorkflowRun;
  expanded: boolean;
  jobs?: GitHubJob[];
  selectedJobId: number | null;
  onToggle: () => void;
  onSelectJob: (j: GitHubJob) => void;
}) {
  return (
    <li className="border-b last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-accent text-left"
      >
        {expanded ? (
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        )}
        <StatusIcon status={run.status} conclusion={run.conclusion} />
        <div className="flex-1 min-w-0">
          <div className="truncate">
            {run.name || "Workflow"}{" "}
            <span className="text-muted-foreground">#{run.runNumber}</span>
          </div>
          <div className="text-muted-foreground truncate">
            {run.event} · {run.headBranch}
          </div>
        </div>
      </button>
      {expanded && (
        <ul className="bg-background/40">
          {!jobs && (
            <li className="px-7 py-1.5 text-muted-foreground italic">Carregando jobs…</li>
          )}
          {jobs?.length === 0 && (
            <li className="px-7 py-1.5 text-muted-foreground italic">Sem jobs.</li>
          )}
          {jobs?.map((job) => (
            <li key={job.id}>
              <button
                onClick={() => onSelectJob(job)}
                className={
                  "w-full flex items-center gap-1.5 px-7 py-1 text-left hover:bg-accent " +
                  (selectedJobId === job.id ? "bg-accent" : "")
                }
              >
                <StatusIcon status={job.status} conclusion={job.conclusion} />
                <span className="truncate">{job.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
});

function StatusIcon({ status, conclusion }: { status: string; conclusion: string }) {
  if (ACTIVE_STATUSES.has(status)) {
    return <Loader2 className="size-3 shrink-0 text-amber-500 animate-spin" />;
  }
  if (status === "completed") {
    if (conclusion === "success") return <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />;
    if (conclusion === "failure") return <XCircle className="size-3 shrink-0 text-destructive" />;
    if (conclusion === "cancelled") return <CircleX className="size-3 shrink-0 text-muted-foreground" />;
    if (conclusion === "skipped") return <CircleDashed className="size-3 shrink-0 text-muted-foreground" />;
  }
  return <PlayCircle className="size-3 shrink-0 text-muted-foreground" />;
}
