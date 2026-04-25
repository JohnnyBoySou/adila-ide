import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";
import { useConfig } from "@/hooks/useConfig";

type Sample = { count: number; total: number; max: number; phase: string };

type SessionEntry = {
  id: string;
  phase: string;
  startTime: number;
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
};

const buckets = new Map<string, Sample>();
let flushTimer: number | undefined;
let sessionStart = 0;
let sessionLog: SessionEntry[] = [];

function flush(threshold: number) {
  if (buckets.size === 0) return;
  const rows: Array<{
    id: string;
    phase: string;
    renders: number;
    totalMs: string;
    avgMs: string;
    maxMs: string;
  }> = [];
  for (const [id, s] of buckets.entries()) {
    if (s.max < threshold) continue;
    rows.push({
      id,
      phase: s.phase,
      renders: s.count,
      totalMs: s.total.toFixed(2),
      avgMs: (s.total / s.count).toFixed(2),
      maxMs: s.max.toFixed(2),
    });
  }
  if (rows.length > 0) {
    rows.sort((a, b) => Number(b.maxMs) - Number(a.maxMs));
    // eslint-disable-next-line no-console
    console.groupCollapsed(`[Profiler] ${rows.length} hot subtree(s)`);
    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
  buckets.clear();
}

function makeOnRender(threshold: number): ProfilerOnRenderCallback {
  return (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    if (sessionStart === 0) sessionStart = commitTime;
    sessionLog.push({ id, phase, startTime, actualDuration, baseDuration, commitTime });

    const prev = buckets.get(id);
    if (prev) {
      prev.count += 1;
      prev.total += actualDuration;
      if (actualDuration > prev.max) prev.max = actualDuration;
      prev.phase = phase;
    } else {
      buckets.set(id, {
        count: 1,
        total: actualDuration,
        max: actualDuration,
        phase,
      });
    }
    if (flushTimer === undefined) {
      flushTimer = window.setTimeout(() => {
        flushTimer = undefined;
        flush(threshold);
      }, 1000);
    }
  };
}

export function downloadProfile() {
  if (sessionLog.length === 0) {
    // eslint-disable-next-line no-console
    console.warn("[Profiler] Nenhum dado capturado. Habilite o profiler e interaja com a UI primeiro.");
    return;
  }
  const aggregates = new Map<string, { renders: number; totalMs: number; maxMs: number; mountCount: number; updateCount: number }>();
  for (const e of sessionLog) {
    const a = aggregates.get(e.id) ?? { renders: 0, totalMs: 0, maxMs: 0, mountCount: 0, updateCount: 0 };
    a.renders += 1;
    a.totalMs += e.actualDuration;
    if (e.actualDuration > a.maxMs) a.maxMs = e.actualDuration;
    if (e.phase === "mount") a.mountCount += 1;
    else a.updateCount += 1;
    aggregates.set(e.id, a);
  }
  const summary = Array.from(aggregates.entries())
    .map(([id, a]) => ({
      id,
      renders: a.renders,
      mounts: a.mountCount,
      updates: a.updateCount,
      totalMs: Number(a.totalMs.toFixed(3)),
      avgMs: Number((a.totalMs / a.renders).toFixed(3)),
      maxMs: Number(a.maxMs.toFixed(3)),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  const last = sessionLog[sessionLog.length - 1];
  const durationMs = last ? last.commitTime - sessionStart : 0;

  const payload = {
    capturedAt: new Date().toISOString(),
    durationMs: Number(durationMs.toFixed(2)),
    totalCommits: sessionLog.length,
    summary,
    events: sessionLog,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dev-profile-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function clearProfile() {
  sessionLog = [];
  sessionStart = 0;
  buckets.clear();
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  // eslint-disable-next-line no-console
  console.info("[Profiler] sessão limpa.");
}

export function DevProfiler({ id, children }: { id: string; children: ReactNode }) {
  const { value: enabled } = useConfig<boolean>("developer.profiler", false);
  const { value: threshold } = useConfig<number>("developer.profilerThreshold", 5);

  if (!enabled) return <>{children}</>;

  return (
    <Profiler id={id} onRender={makeOnRender(typeof threshold === "number" ? threshold : 5)}>
      {children}
    </Profiler>
  );
}
