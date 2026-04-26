import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { FileCode2, FileJson, FileText, FolderOpen, RefreshCw } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { rpc, type BenchHistoryFile } from "./rpc";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDate(unix: number): string {
  if (!unix) return "—";
  const d = new Date(unix * 1000);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relTime(unix: number): string {
  if (!unix) return "";
  const diff = Math.max(0, Date.now() / 1000 - unix);
  if (diff < 60) return "agora";
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return fmtDate(unix);
}

function FormatIcon({ format }: { format: string }) {
  if (format === "json") return <FileJson className="size-3.5" />;
  if (format === "md") return <FileText className="size-3.5" />;
  return <FileCode2 className="size-3.5" />;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "go":
      return "Go";
    case "frontend":
      return "Frontend";
    case "baseline":
      return "Baseline";
    default:
      return "Outro";
  }
}

function kindClass(kind: string): string {
  switch (kind) {
    case "go":
      return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
    case "frontend":
      return "bg-purple-500/10 text-purple-300 border-purple-500/20";
    case "baseline":
      return "bg-amber-500/10 text-amber-300 border-amber-500/20";
    default:
      return "";
  }
}

type Filter = "all" | "go" | "frontend";

export const HistoryPanel = memo(function HistoryPanel() {
  const [files, setFiles] = useState<BenchHistoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [contentLoading, setContentLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await rpc.bench.history();
      setFiles(list ?? []);
      // Se nada selecionado ainda, escolhe o mais recente.
      if (!selected && list && list.length > 0) {
        setSelected(list[0].name);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) {
      setContent("");
      return;
    }
    let cancelled = false;
    setContentLoading(true);
    rpc.bench
      .read(selected)
      .then((c) => {
        if (!cancelled) setContent(c);
      })
      .catch((e: unknown) => {
        if (!cancelled) setContent(`Erro ao ler ${selected}: ${e instanceof Error ? e.message : e}`);
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    if (filter === "all") return files;
    return files.filter((f) => f.kind === filter);
  }, [files, filter]);

  const counts = useMemo(() => {
    const c = { go: 0, frontend: 0, total: files.length };
    for (const f of files) {
      if (f.kind === "go") c.go++;
      else if (f.kind === "frontend") c.frontend++;
    }
    return c;
  }, [files]);

  const openFolder = useCallback(() => {
    rpc.bench
      .openFolder()
      .catch((e: unknown) => toast.error("Não foi possível abrir a pasta", e));
  }, []);

  return (
    <div className="flex h-full w-full">
      {/* Sidebar com lista */}
      <aside className="w-72 shrink-0 border-r border-border/60 bg-card/40 flex flex-col">
        <div className="px-4 py-3 border-b border-border/60 space-y-2">
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-card/40 p-0.5">
            <FilterTab active={filter === "all"} onClick={() => setFilter("all")}>
              Tudo
              <Badge variant="secondary" className="ml-1.5 text-[9px]">
                {counts.total}
              </Badge>
            </FilterTab>
            <FilterTab active={filter === "go"} onClick={() => setFilter("go")}>
              Go
              <Badge variant="secondary" className="ml-1.5 text-[9px]">
                {counts.go}
              </Badge>
            </FilterTab>
            <FilterTab active={filter === "frontend"} onClick={() => setFilter("frontend")}>
              Front
              <Badge variant="secondary" className="ml-1.5 text-[9px]">
                {counts.frontend}
              </Badge>
            </FilterTab>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={openFolder}
              className="flex-1 gap-1.5"
              title="Abrir pasta benchmarks/"
            >
              <FolderOpen className="size-3.5" />
              Abrir pasta
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void refresh()}
              title="Recarregar"
              className="shrink-0"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar p-2">
          {loading && files.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : error ? (
            <p className="px-2 py-4 text-xs text-destructive">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground text-center">
              {files.length === 0 ? "Pasta benchmarks/ vazia." : "Nenhum arquivo nesse filtro."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {filtered.map((f) => (
                <li key={f.name}>
                  <button
                    type="button"
                    onClick={() => setSelected(f.name)}
                    className={cn(
                      "group flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors cursor-pointer",
                      selected === f.name
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50",
                    )}
                    title={f.path}
                  >
                    <div className="flex w-full items-center gap-1.5">
                      <span className="text-muted-foreground">
                        <FormatIcon format={f.format} />
                      </span>
                      <span className="flex-1 truncate font-mono text-[11px]">{f.name}</span>
                    </div>
                    <div className="flex w-full items-center gap-2 pl-5 text-[10px] text-muted-foreground">
                      <span
                        className={cn(
                          "inline-flex rounded border px-1 py-0 leading-tight",
                          kindClass(f.kind),
                        )}
                      >
                        {kindLabel(f.kind)}
                      </span>
                      <span className="tabular-nums">{fmtBytes(f.size)}</span>
                      <span className="ml-auto tabular-nums">{relTime(f.modUnix)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {/* Visualizador */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b border-border/60 px-6 py-3">
              <FormatIcon
                format={files.find((f) => f.name === selected)?.format ?? "txt"}
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs truncate">{selected}</p>
                <p className="text-[10px] text-muted-foreground">
                  {fmtDate(files.find((f) => f.name === selected)?.modUnix ?? 0)} ·{" "}
                  {fmtBytes(files.find((f) => f.name === selected)?.size ?? 0)}
                </p>
              </div>
            </header>
            <div className="flex-1 overflow-auto scrollbar bg-card/20">
              {contentLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size="md" />
                </div>
              ) : (
                <pre className="px-6 py-5 text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words">
                  {content}
                </pre>
              )}
            </div>
          </>
        ) : (
          <EmptyState
            title="Selecione um relatório"
            description="Os arquivos da pasta benchmarks/ aparecem na lista ao lado."
          />
        )}
      </main>
    </div>
  );
});

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 inline-flex items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
