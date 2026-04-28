// Bench de I/O do terminal — roda dentro do WebKitGTK real, não em vitest.
// Pergunta a responder: "qual transporte é mais rápido para keystroke?"
//
//   A. Wails RPC echo            (BenchEchoFetch)
//   B. Wails RPC -> runtime Event (BenchEchoViaEvents)
//   C. WebSocket binário          (/bench/echo, mesma porta do PTY bridge)
//
// Disparar via devtools:  await window.__termIOBench(500)
//
// Reporta min / p50 / p95 / p99 / max / mean (ms) por path. Dispara um
// warmup antes pra evitar viés do primeiro JIT/handshake.

import { EventsOff, EventsOn } from "../../wailsjs/runtime/runtime";
import {
  BenchEchoFetch,
  BenchSaveResult,
  BenchEchoViaEvents,
  GetTerminalPort,
} from "../../wailsjs/go/main/Terminal";

type Stats = {
  path: string;
  rounds: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx];
}

function summarize(path: string, samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    path,
    rounds: samples.length,
    min: sorted[0] ?? 0,
    p50: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    p99: quantile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
    mean: samples.length ? sum / samples.length : 0,
  };
}

async function benchFetch(rounds: number, payload: string): Promise<number[]> {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const t0 = performance.now();
    await BenchEchoFetch(payload);
    samples.push(performance.now() - t0);
  }
  return samples;
}

async function benchFetchToEvent(rounds: number, payload: string): Promise<number[]> {
  const samples: number[] = [];
  // listener único, identifica round via correlationId
  let pendingResolve: ((v: void) => void) | null = null;
  let pendingId = "";
  const eventName = (id: string) => `bench:io:${id}`;

  for (let i = 0; i < rounds; i++) {
    const id = `r${i}`;
    pendingId = id;
    const off = EventsOn(eventName(id), () => {
      if (pendingResolve) {
        const r = pendingResolve;
        pendingResolve = null;
        r();
      }
    });
    const waitFor = new Promise<void>((res) => {
      pendingResolve = res;
    });
    const t0 = performance.now();
    BenchEchoViaEvents(id, payload);
    await waitFor;
    samples.push(performance.now() - t0);
    EventsOff(eventName(id));
    void off;
    void pendingId;
  }
  return samples;
}

async function benchWS(rounds: number, payload: string): Promise<number[]> {
  const port = await GetTerminalPort();
  if (!port) throw new Error("terminal port not available");
  const ws = new WebSocket(`ws://127.0.0.1:${port}/bench/echo`);
  ws.binaryType = "arraybuffer";
  await new Promise<void>((res, rej) => {
    ws.onopen = () => res();
    ws.onerror = (e) => rej(e);
  });
  const enc = new TextEncoder();
  const samples: number[] = [];
  try {
    for (let i = 0; i < rounds; i++) {
      const t0 = performance.now();
      const done = new Promise<void>((res) => {
        ws.onmessage = () => res();
      });
      ws.send(enc.encode(payload));
      await done;
      samples.push(performance.now() - t0);
    }
  } finally {
    ws.close();
  }
  return samples;
}

export async function runTerminalIOBench(rounds = 500, payloadSize = 8): Promise<Stats[]> {
  const payload = "x".repeat(payloadSize);

  // warmup: 20 iterações em cada path pra estabilizar JIT/conexão
  await benchFetch(20, payload).catch(() => {});
  await benchFetchToEvent(20, payload).catch(() => {});
  await benchWS(20, payload).catch(() => {});

  const fetchSamples = await benchFetch(rounds, payload);
  const fteSamples = await benchFetchToEvent(rounds, payload);
  const wsSamples = await benchWS(rounds, payload);

  const stats = [
    summarize("Wails RPC (fetch)", fetchSamples),
    summarize("RPC + Event (half-duplex)", fteSamples),
    summarize("WebSocket binário", wsSamples),
  ];

  // formato amigável pra console.table
  const rows = stats.map((s) => ({
    path: s.path,
    n: s.rounds,
    min: s.min.toFixed(2),
    p50: s.p50.toFixed(2),
    p95: s.p95.toFixed(2),
    p99: s.p99.toFixed(2),
    max: s.max.toFixed(2),
    mean: s.mean.toFixed(2),
  }));
  // eslint-disable-next-line no-console
  console.table(rows);

  // expõe samples crus pra quem quiser inspecionar
  (window as unknown as { __benchTermSamples?: unknown }).__benchTermSamples = {
    fetch: fetchSamples,
    fetchToEvent: fteSamples,
    ws: wsSamples,
  };

  // persiste em disco pra o /loop conseguir ler sem copy-paste manual
  try {
    const payload = JSON.stringify(
      {
        rounds,
        payloadSize,
        ts: new Date().toISOString(),
        userAgent: navigator.userAgent,
        stats,
        samples: {
          fetch: fetchSamples,
          fetchToEvent: fteSamples,
          ws: wsSamples,
        },
      },
      null,
      2,
    );
    const path = await BenchSaveResult(payload);
    // eslint-disable-next-line no-console
    console.log("[bench] saved:", path);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[bench] save failed:", e);
  }

  return stats;
}
