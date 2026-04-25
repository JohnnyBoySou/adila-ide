import { useCallback, useEffect, useState } from "react";
import { Activity, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { rpc, type BenchOp } from "./rpc";

const REFRESH_MS = 1000;

function fmtNs(ns: number): string {
  if (ns <= 0) return "—";
  if (ns < 1_000) return `${ns} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  return `${(ns / 1_000_000_000).toFixed(2)} s`;
}

function fmtCount(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function fmtTotal(ns: number): string {
  // Total time accumulated — show in ms / s / min for legibility.
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(0)} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(1)} ms`;
  if (ns < 60 * 1_000_000_000) return `${(ns / 1_000_000_000).toFixed(2)} s`;
  return `${(ns / 60_000_000_000).toFixed(2)} min`;
}

// Color tier the p95 column: under 1ms quiet, 1-50ms neutral, > 50ms warn.
function p95Class(ns: number): string {
  if (ns >= 50_000_000) return "text-red-400";
  if (ns >= 5_000_000) return "text-amber-400";
  if (ns >= 1_000_000) return "text-foreground";
  return "text-muted-foreground";
}

type Props = {
  onClose?: () => void;
};

export function BenchView({ onClose }: Props = {}) {
  const [ops, setOps] = useState<BenchOp[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [paused, setPaused] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, en] = await Promise.all([rpc.bench.stats(), rpc.bench.isEnabled()]);
      setOps(s);
      setEnabled(en);
    } catch {
      // Silenciado — view não deve quebrar se a coleta falhar momentaneamente.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [paused, refresh]);

  const onToggleEnabled = async () => {
    await rpc.bench.setEnabled(!enabled);
    await refresh();
  };

  const onReset = async () => {
    await rpc.bench.reset();
    await refresh();
  };

  const grandTotal = ops.reduce((acc, o) => acc + o.totalNs, 0);
  const grandCount = ops.reduce((acc, o) => acc + o.count, 0);

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-6 py-4">
        <Activity className="size-5 text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold">Benchmarks de runtime</h1>
          <p className="text-xs text-muted-foreground">
            Latência por chamada RPC instrumentada · {fmtCount(grandCount)} chamadas ·{" "}
            {fmtTotal(grandTotal)} acumulado
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            title={paused ? "Retomar refresh" : "Pausar refresh"}
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            {paused ? "Retomar" : "Pausar"}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} title="Zerar contadores">
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
          <Button
            variant={enabled ? "default" : "outline"}
            size="sm"
            onClick={onToggleEnabled}
            title="Habilitar/desabilitar coleta"
          >
            {enabled ? "Coletando" : "Pausado"}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              title="Fechar"
              aria-label="Fechar benchmarks"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto scrollbar">
        {ops.length === 0 ? (
          <EmptyState
            title="Nenhuma operação registrada ainda"
            description="Use o IDE — abrir pastas, buscar, editar — e os tempos aparecerão aqui."
          />
        ) : (
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-card/95 backdrop-blur border-b border-border/60">
              <tr className="text-left text-muted-foreground">
                <th className="px-6 py-2 font-medium">Operação</th>
                <th className="px-3 py-2 font-medium text-right">Chamadas</th>
                <th className="px-3 py-2 font-medium text-right">Total</th>
                <th className="px-3 py-2 font-medium text-right">Média</th>
                <th className="px-3 py-2 font-medium text-right">p50</th>
                <th className="px-3 py-2 font-medium text-right">p95</th>
                <th className="px-3 py-2 font-medium text-right">p99</th>
                <th className="px-3 py-2 font-medium text-right">Máx</th>
                <th className="px-6 py-2 font-medium text-right">Última</th>
              </tr>
            </thead>
            <tbody>
              {ops.map((o) => (
                <tr
                  key={o.name}
                  className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-6 py-2 font-mono">{o.name}</td>
                  <td className="px-3 py-2 text-right">{fmtCount(o.count)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {fmtTotal(o.totalNs)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtNs(o.meanNs)}</td>
                  <td className="px-3 py-2 text-right">{fmtNs(o.p50Ns)}</td>
                  <td className={cn("px-3 py-2 text-right", p95Class(o.p95Ns))}>
                    {fmtNs(o.p95Ns)}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtNs(o.p99Ns)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {fmtNs(o.maxNs)}
                  </td>
                  <td className="px-6 py-2 text-right text-muted-foreground">
                    {fmtNs(o.lastNs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
