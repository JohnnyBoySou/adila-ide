import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const SAMPLE_MS = 500;
const SNAPSHOT_MS = 30_000;
const MAX_SNAPSHOTS = 10; // 10 × 30s = 5 min

type Snapshot = {
  t: number; // timestamp ms
  avg: number;
  min: number;
  max: number;
};

function fpsClass(fps: number): string {
  if (fps >= 55) return "text-green-400";
  if (fps >= 40) return "text-amber-400";
  return "text-red-400";
}

function fpsStroke(fps: number): string {
  if (fps >= 55) return "#4ade80";
  if (fps >= 40) return "#fbbf24";
  return "#f87171";
}

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s atrás`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? ` ${s % 60}s` : ""} atrás`;
}

export function FpsMeter() {
  const [fps, setFps] = useState(0);
  const [min, setMin] = useState(0);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const rafRef = useRef<number | undefined>(undefined);
  const framesRef = useRef(0);
  const lastSampleRef = useRef(performance.now());
  const minRef = useRef<number | null>(null);

  // Buffer da janela atual de snapshot (acumula samples nos últimos 30s).
  const windowRef = useRef<{ start: number; samples: number[] }>({
    start: Date.now(),
    samples: [],
  });

  useEffect(() => {
    function tick(now: number) {
      framesRef.current += 1;
      const elapsed = now - lastSampleRef.current;
      if (elapsed >= SAMPLE_MS) {
        const sample = Math.round((framesRef.current * 1000) / elapsed);
        setFps(sample);
        if (minRef.current === null || sample < minRef.current) {
          minRef.current = sample;
          setMin(sample);
        }
        windowRef.current.samples.push(sample);
        framesRef.current = 0;
        lastSampleRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // A cada 30s, fecha a janela: gera snapshot {avg, min, max} e mantém só os últimos 10.
  useEffect(() => {
    const id = window.setInterval(() => {
      const win = windowRef.current;
      if (win.samples.length === 0) {
        win.start = Date.now();
        return;
      }
      let sum = 0;
      let mn = win.samples[0];
      let mx = win.samples[0];
      for (const v of win.samples) {
        sum += v;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      const snap: Snapshot = {
        t: Date.now(),
        avg: Math.round(sum / win.samples.length),
        min: mn,
        max: mx,
      };
      setSnapshots((prev) => {
        const next = [...prev, snap];
        return next.length > MAX_SNAPSHOTS ? next.slice(-MAX_SNAPSHOTS) : next;
      });
      windowRef.current = { start: Date.now(), samples: [] };
    }, SNAPSHOT_MS);
    return () => window.clearInterval(id);
  }, []);

  const updateAnchor = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setAnchor({ left: r.left + r.width / 2, bottom: window.innerHeight - r.top });
  }, []);

  // Reposiciona ao abrir e em scroll/resize enquanto aberto.
  useEffect(() => {
    if (!open) return;
    updateAnchor();
    const onResize = () => updateAnchor();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updateAnchor]);

  // Fecha em clique externo / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const tgt = e.target as Node;
      if (panelRef.current?.contains(tgt) || triggerRef.current?.contains(tgt)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 px-2.5 h-full shrink-0 font-mono tabular-nums cursor-pointer transition-colors hover:bg-accent/50",
          open && "bg-accent/60",
        )}
        aria-label={`${fps} FPS — abrir gráfico de desempenho`}
        aria-expanded={open}
        title={`${fps} fps · min ${min} · clique para histórico`}
      >
        <span className={cn("font-semibold", fpsClass(fps))}>{fps}</span>
        <span className="text-muted-foreground">fps</span>
      </button>

      {open && anchor &&
        createPortal(
          <FpsPanel
            ref={panelRef}
            anchor={anchor}
            current={fps}
            min={min}
            snapshots={snapshots}
            windowStart={windowRef.current.start}
          />,
          document.body,
        )}
    </>
  );
}

interface PanelProps {
  anchor: { left: number; bottom: number };
  current: number;
  min: number;
  snapshots: Snapshot[];
  windowStart: number;
}

const FpsPanel = ({
  ref,
  anchor,
  current,
  min,
  snapshots,
  windowStart,
}: PanelProps & { ref?: React.Ref<HTMLDivElement> }) => {
  const W = 320;
  const H = 120;
  const PAD_X = 8;
  const PAD_Y = 8;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const yMax = 60; // teto do gráfico = 60 fps

  const points = snapshots.map((s, i) => {
    const x = PAD_X + (i / Math.max(1, MAX_SNAPSHOTS - 1)) * innerW;
    const y = PAD_Y + (1 - Math.min(s.avg, yMax) / yMax) * innerH;
    return { x, y, snap: s };
  });

  const linePath = points.length
    ? points
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ")
    : "";

  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD_Y + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD_Y + innerH).toFixed(1)} Z`
    : "";

  const lastSnap = snapshots[snapshots.length - 1];
  const oldestSnap = snapshots[0];
  const stroke = lastSnap ? fpsStroke(lastSnap.avg) : "#4ade80";

  // Posiciona a 8px acima do trigger, centralizado, mas sem sair da viewport.
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, anchor.left - W / 2));
  const bottom = anchor.bottom + 6;

  const now = Date.now();

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Gráfico de FPS"
      className="fixed z-[100] rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-xl"
      style={{ left, bottom, width: W }}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className={cn("text-base font-semibold", fpsClass(current))}>{current}</span>
          <span className="text-[10px] text-muted-foreground">fps</span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          min {min} · 5 min
        </div>
      </header>

      <div className="px-2 pt-2 pb-1">
        {snapshots.length === 0 ? (
          <div
            className="flex items-center justify-center text-[11px] text-muted-foreground"
            style={{ height: H }}
          >
            Coletando primeiro snapshot… (~{Math.max(1, 30 - Math.floor((now - windowStart) / 1000))}
            s)
          </div>
        ) : (
          <svg
            width={W - 16}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Linhas de grade horizontais para 30 e 60 fps */}
            {[60, 30].map((v) => {
              const y = PAD_Y + (1 - v / yMax) * innerH;
              return (
                <g key={v}>
                  <line
                    x1={PAD_X}
                    y1={y}
                    x2={W - PAD_X}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="2 3"
                  />
                  <text
                    x={W - PAD_X}
                    y={y - 2}
                    textAnchor="end"
                    fontSize="9"
                    className="fill-muted-foreground"
                    opacity={0.6}
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            <defs>
              <linearGradient id="fps-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>

            {areaPath && <path d={areaPath} fill="url(#fps-area)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={stroke}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={2.2} fill={fpsStroke(p.snap.avg)} />
                <title>
                  {p.snap.avg} fps · min {p.snap.min} · max {p.snap.max} ·{" "}
                  {formatAge(now - p.snap.t)}
                </title>
              </g>
            ))}
          </svg>
        )}
      </div>

      <footer className="flex items-center justify-between px-3 py-1.5 border-t border-border/40 text-[10px] text-muted-foreground tabular-nums">
        <span>{oldestSnap ? formatAge(now - oldestSnap.t) : "—"}</span>
        <span>
          snapshot a cada 30s · {snapshots.length}/{MAX_SNAPSHOTS}
        </span>
        <span>agora</span>
      </footer>
    </div>
  );
};
