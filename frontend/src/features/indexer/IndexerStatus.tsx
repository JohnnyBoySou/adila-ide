import { memo, useEffect, useState } from "react";
import { Boxes, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GetStatus } from "../../../wailsjs/go/main/Indexer";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

type Stage = "idle" | "indexing" | "ready" | "synced";

type State = {
  stage: Stage;
  indexed: number;
  total: number;
};

const initial: State = { stage: "idle", indexed: 0, total: 0 };

/**
 * IndexerStatus mostra na status bar o progresso da indexação tree-sitter.
 *
 * Estados:
 * - idle:     sem workspace ou sem dados ainda → componente esconde
 * - indexing: emite "Indexando 234/1200" enquanto runIndex está ativo
 * - ready:    fade pra "Índice pronto · 1200" por 4s após ready
 * - synced:   pulso curto após sync incremental (edits do usuário)
 *
 * Lê o estado inicial via GetStatus pra cobrir o caso "frontend remontou no
 * meio da indexação" (HMR ou refresh manual).
 */
export const IndexerStatus = memo(function IndexerStatus() {
  const [state, setState] = useState<State>(initial);

  useEffect(() => {
    let cancelled = false;
    void GetStatus()
      .then((s) => {
        if (cancelled || !s) return;
        if (s.indexing) {
          setState({ stage: "indexing", indexed: s.indexed, total: s.total });
        } else if (s.total > 0) {
          // Já existia índice — mostra "ready" mas sem fade, pra usuário
          // saber que está pronto na hora que abriu o app.
          setState({ stage: "ready", indexed: s.indexed || s.total, total: s.total });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const offProgress = EventsOn(
      "indexer.progress",
      (payload: { indexed?: number; total?: number }) => {
        const indexed = payload?.indexed ?? 0;
        const total = payload?.total ?? 0;
        setState({ stage: "indexing", indexed, total });
      },
    );
    const offReady = EventsOn("indexer.ready", (payload: { indexed?: number; total?: number }) => {
      setState({
        stage: "ready",
        indexed: payload?.indexed ?? 0,
        total: payload?.total ?? 0,
      });
    });
    const offChanged = EventsOn("indexer.changed", () => {
      setState((s) => ({ ...s, stage: "synced" }));
    });
    return () => {
      offProgress();
      offReady();
      offChanged();
    };
  }, []);

  // Auto-fade de "synced" pra "ready" depois de 1.5s.
  useEffect(() => {
    if (state.stage !== "synced") return;
    const t = setTimeout(() => {
      setState((s) => (s.stage === "synced" ? { ...s, stage: "ready" } : s));
    }, 1500);
    return () => clearTimeout(t);
  }, [state.stage]);

  if (state.stage === "idle") return null;

  if (state.stage === "indexing") {
    const pct =
      state.total > 0 ? Math.min(100, Math.round((state.indexed / state.total) * 100)) : 0;
    return (
      <span
        className="flex items-center gap-1.5 px-2.5 h-full text-muted-foreground"
        title={`Indexador tree-sitter: ${state.indexed} de ${state.total} arquivos (${pct}%)`}
      >
        <Boxes className="size-3 animate-pulse" />
        <span className="tabular-nums">
          {state.indexed}/{state.total}
        </span>
      </span>
    );
  }

  // ready ou synced
  const synced = state.stage === "synced";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 px-2.5 h-full text-muted-foreground transition-colors",
        synced && "text-emerald-500",
      )}
      title={`Índice pronto · ${state.total} arquivos · clique para reindexar`}
    >
      <CheckCircle2 className={cn("size-3", synced && "animate-pulse")} />
      <span className="tabular-nums">{state.total}</span>
    </span>
  );
});
