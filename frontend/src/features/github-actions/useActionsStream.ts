import { useCallback, useEffect, useRef, useState } from "react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
  CurrentRepoSlug,
  ListRunJobs,
  ListWorkflowRuns,
  UnwatchRepoActions,
  WatchJobLogs as WatchJobLogsRPC,
  WatchRepoActions,
} from "../../../wailsjs/go/main/GitHub";
import type {
  GitHubJob,
  GitHubWorkflowRun,
  JobsPayload,
  LogChunk,
  LogsDonePayload,
  RunsPayload,
  WatchStatus,
} from "./types";

type State = {
  status: WatchStatus;
  runs: GitHubWorkflowRun[];
  jobsByRun: Map<number, GitHubJob[]>;
  loading: boolean;
  error?: string;
};

type LogsState = Map<number, { text: string; done: boolean }>;

export function useActionsStream() {
  const [state, setState] = useState<State>({
    status: { watching: false },
    runs: [],
    jobsByRun: new Map(),
    loading: false,
  });
  const [logs, setLogs] = useState<LogsState>(new Map());
  const watchedRef = useRef<{ owner: string; repo: string } | null>(null);

  // Listeners — montados uma vez.
  useEffect(() => {
    const offRuns = EventsOn("github.actions.runs", (p: RunsPayload) => {
      setState((s) => ({ ...s, runs: p?.runs ?? [], loading: false }));
    });
    const offJobs = EventsOn("github.actions.jobs", (p: JobsPayload) => {
      setState((s) => {
        const next = new Map(s.jobsByRun);
        next.set(p.runId, p.jobs);
        return { ...s, jobsByRun: next };
      });
    });
    const offLogs = EventsOn("github.actions.logs.append", (p: LogChunk) => {
      setLogs((prev) => {
        const next = new Map(prev);
        const cur = next.get(p.jobId) ?? { text: "", done: false };
        const text = p.fullReplace ? p.chunk : cur.text + p.chunk;
        next.set(p.jobId, { text, done: cur.done });
        return next;
      });
    });
    const offDone = EventsOn("github.actions.logs.done", (p: LogsDonePayload) => {
      setLogs((prev) => {
        const next = new Map(prev);
        const cur = next.get(p.jobId) ?? { text: "", done: false };
        next.set(p.jobId, { ...cur, done: true });
        return next;
      });
    });
    const offStatus = EventsOn("github.actions.status", (p: WatchStatus) => {
      setState((s) => ({ ...s, status: p, error: p?.error, loading: false }));
    });
    return () => {
      offRuns?.();
      offJobs?.();
      offLogs?.();
      offDone?.();
      offStatus?.();
    };
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const slug = await CurrentRepoSlug();
      if (!slug?.owner || !slug?.repo) throw new Error("repositório não detectado");
      watchedRef.current = { owner: slug.owner, repo: slug.repo };
      await WatchRepoActions(slug.owner, slug.repo);
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  const stop = useCallback(async () => {
    watchedRef.current = null;
    await UnwatchRepoActions().catch(() => undefined);
  }, []);

  // Carrega manualmente runs/jobs (sem ativar watcher) — usado pra refresh único.
  const refresh = useCallback(async () => {
    const w = watchedRef.current;
    if (!w) return;
    setState((s) => ({ ...s, loading: true }));
    const runs = await ListWorkflowRuns(w.owner, w.repo, 25).catch(() => [] as GitHubWorkflowRun[]);
    setState((s) => ({ ...s, runs, loading: false }));
  }, []);

  const loadJobs = useCallback(async (runId: number) => {
    const w = watchedRef.current;
    if (!w) return;
    const jobs = await ListRunJobs(w.owner, w.repo, runId).catch(() => [] as GitHubJob[]);
    setState((s) => {
      const next = new Map(s.jobsByRun);
      next.set(runId, jobs);
      return { ...s, jobsByRun: next };
    });
  }, []);

  const focusJob = useCallback(async (jobId: number) => {
    setLogs((prev) => {
      if (prev.has(jobId)) return prev;
      const next = new Map(prev);
      next.set(jobId, { text: "", done: false });
      return next;
    });
    await WatchJobLogsRPC(jobId).catch(() => undefined);
  }, []);

  return {
    ...state,
    logs,
    start,
    stop,
    refresh,
    loadJobs,
    focusJob,
  };
}
