import type { GitHubJob, GitHubWorkflowRun } from "../../../bindings/ide/models";

export type RunStatus = "queued" | "in_progress" | "waiting" | "completed";

export type LogChunk = {
  jobId: number;
  chunk: string;
  fullReplace: boolean;
};

export type WatchStatus = {
  watching: boolean;
  owner?: string;
  repo?: string;
  error?: string;
};

export type RunsPayload = { runs: GitHubWorkflowRun[] };
export type JobsPayload = { runId: number; jobs: GitHubJob[] };
export type LogsDonePayload = { jobId: number };

export const ACTIVE_STATUSES = new Set(["queued", "in_progress", "waiting"]);

export type { GitHubJob, GitHubWorkflowRun };
