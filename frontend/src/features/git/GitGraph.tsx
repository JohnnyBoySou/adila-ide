import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GitBranch as GitBranchIcon,
  Loader2,
  Maximize2,
  RefreshCw,
  Tag,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rpc } from "./rpc";
import type { GitGraphNode } from "./types";

// ─── layout constants ────────────────────────────────────────────────────────
const COL_W = 20; // horizontal spacing between lanes
const ROW_H = 36; // row height
const R = 5; // node circle radius
const PAD_LEFT = 10; // left padding before first lane

const COLORS = [
  "#4f9cf9",
  "#f97b3d",
  "#4ade80",
  "#fbbf24",
  "#c084fc",
  "#f87171",
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#818cf8",
  "#e879f9",
];

// ─── types ───────────────────────────────────────────────────────────────────
interface Lane {
  hash: string;
  colorIdx: number;
}

interface LayoutNode extends GitGraphNode {
  row: number;
  col: number;
  color: string;
  colorIdx: number;
  x: number;
  y: number;
}

interface EdgePath {
  d: string;
  color: string;
  key: string;
}

// ─── layout algorithm ────────────────────────────────────────────────────────
function computeLayout(rawNodes: GitGraphNode[]): {
  nodes: LayoutNode[];
  edges: EdgePath[];
  width: number;
  height: number;
} {
  const lanes: Lane[] = [];
  let nextColorIdx = 0;
  const positioned: LayoutNode[] = [];

  for (let row = 0; row < rawNodes.length; row++) {
    const node = rawNodes[row];

    let col = lanes.findIndex((l) => l.hash === node.hash);
    if (col === -1) {
      col = lanes.length;
      lanes.push({ hash: node.hash, colorIdx: nextColorIdx++ % COLORS.length });
    }

    const colorIdx = lanes[col].colorIdx;
    const color = COLORS[colorIdx];
    const x = PAD_LEFT + col * COL_W;
    const y = ROW_H / 2 + row * ROW_H;

    // Update lanes for parents
    if (node.parents.length === 0) {
      lanes.splice(col, 1);
    } else {
      lanes[col] = { hash: node.parents[0], colorIdx };
      for (const parent of node.parents.slice(1)) {
        if (!lanes.some((l) => l.hash === parent)) {
          lanes.push({ hash: parent, colorIdx: nextColorIdx++ % COLORS.length });
        }
      }
    }

    positioned.push({ ...node, row, col, color, colorIdx, x, y });
  }

  const byHash = new Map(positioned.map((n) => [n.hash, n]));
  const maxCol = Math.max(...positioned.map((n) => n.col), 0);
  const width = PAD_LEFT + (maxCol + 1) * COL_W + 4;
  const height = positioned.length * ROW_H;

  // Build edge paths
  const edges: EdgePath[] = [];
  for (const node of positioned) {
    for (let pi = 0; pi < node.parents.length; pi++) {
      const parent = byHash.get(node.parents[pi]);
      if (!parent) continue;

      const x1 = node.x;
      const y1 = node.y;
      const x2 = parent.x;
      const y2 = parent.y;

      let d: string;
      if (x1 === x2) {
        d = `M${x1},${y1 + R} L${x2},${y2 - R}`;
      } else {
        const mid = (y1 + y2) / 2;
        d = `M${x1},${y1 + R} C${x1},${mid} ${x2},${mid} ${x2},${y2 - R}`;
      }

      edges.push({
        d,
        color: pi === 0 ? node.color : COLORS[byHash.get(node.parents[pi])?.colorIdx ?? 0],
        key: `${node.hash}-${node.parents[pi]}`,
      });
    }
  }

  return { nodes: positioned, edges, width, height };
}

// ─── ref badge ───────────────────────────────────────────────────────────────
function RefBadge({ label }: { label: string }) {
  const isTag = label.startsWith("tag: ");
  const text = isTag ? label.slice(5) : label;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-medium leading-4",
        isTag
          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          : "bg-blue-500/20 text-blue-300 border border-blue-500/30",
      )}
    >
      {isTag ? <Tag className="size-2.5" /> : <GitBranchIcon className="size-2.5" />}
      {text}
    </span>
  );
}

// ─── GitGraph component ───────────────────────────────────────────────────────
interface GitGraphProps {
  onClose: () => void;
}

export function GitGraph({ onClose }: GitGraphProps) {
  const [rawNodes, setRawNodes] = useState<GitGraphNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LayoutNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [limit, setLimit] = useState(150);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback((l: number) => {
    setLoading(true);
    rpc.git
      .getGraph(l)
      .then(setRawNodes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(limit);
  }, [load, limit]);

  const { nodes, edges, width, height } = useMemo(() => computeLayout(rawNodes), [rawNodes]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 shrink-0">
        <Maximize2 className="size-4 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">Git Graph</span>
        <span className="text-xs text-muted-foreground">{nodes.length} commits</span>
        <button
          type="button"
          onClick={() => load(limit)}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
          title="Atualizar"
        >
          <RefreshCw className="size-3.5" />
        </button>
        <div className="flex items-center rounded border border-border/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ZoomOut className="size-3.5" />
          </button>
          <span className="px-2 text-xs text-muted-foreground select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <ZoomIn className="size-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph canvas */}
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="flex-1 overflow-auto scrollbar bg-background/50"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem commits no repositório.
            </div>
          ) : (
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: `${width + 600}px`,
                height: `${height}px`,
                position: "relative",
              }}
            >
              {/* SVG edges + nodes */}
              <svg
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: `${width}px`,
                  height: `${height}px`,
                  overflow: "visible",
                }}
              >
                {/* Edges */}
                {edges.map((edge) => (
                  <path
                    key={edge.key}
                    d={edge.d}
                    stroke={edge.color}
                    strokeWidth={1.5}
                    fill="none"
                    opacity={0.7}
                  />
                ))}
                {/* Nodes */}
                {nodes.map((node) => (
                  <circle
                    key={node.hash}
                    cx={node.x}
                    cy={node.y}
                    r={R}
                    fill={selected?.hash === node.hash ? "#fff" : node.color}
                    stroke={node.color}
                    strokeWidth={selected?.hash === node.hash ? 2.5 : 1.5}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(node === selected ? null : node)}
                  />
                ))}
              </svg>

              {/* Row info: refs + commit message */}
              {nodes.map((node) => (
                <div
                  key={`label-${node.hash}`}
                  onClick={() => setSelected(node === selected ? null : node)}
                  className={cn(
                    "absolute flex items-center gap-1.5 cursor-pointer select-none",
                    "text-xs rounded-sm px-1 hover:bg-accent/30 transition-colors",
                    selected?.hash === node.hash && "bg-accent/50",
                  )}
                  style={{
                    left: `${width + 4}px`,
                    top: `${node.y - ROW_H / 2}px`,
                    height: `${ROW_H}px`,
                    minWidth: "400px",
                  }}
                >
                  {node.refs.map((ref) => (
                    <RefBadge key={ref} label={ref} />
                  ))}
                  <span
                    className={cn(
                      "truncate max-w-xs",
                      node.refs.length > 0 ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {node.subject}
                  </span>
                  <span className="text-muted-foreground/50 text-[10px] shrink-0 ml-1">
                    {node.date}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 shrink-0 border-l border-border/60 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <span
                className="size-3 rounded-full shrink-0"
                style={{ background: selected.color }}
              />
              <span className="font-mono text-xs text-muted-foreground">{selected.short}</span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
              <p className="font-medium leading-snug">{selected.subject}</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="text-foreground/70">Autor:</span> {selected.author}
                </p>
                <p>
                  <span className="text-foreground/70">Data:</span> {selected.date}
                </p>
                <p className="font-mono break-all">
                  <span className="text-foreground/70">Hash:</span> {selected.hash}
                </p>
              </div>
              {selected.refs.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.refs.map((ref) => (
                    <RefBadge key={ref} label={ref} />
                  ))}
                </div>
              )}
              {selected.parents.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <p className="text-foreground/70 mb-1">Parents:</p>
                  {selected.parents.map((p) => (
                    <p key={p} className="font-mono">
                      {p.slice(0, 12)}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer: load more */}
      {!loading && nodes.length >= limit && (
        <div className="border-t border-border/60 px-4 py-2 flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 150)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Carregar mais {limit + 150 > 1000 ? "" : `(+150)`}…
          </button>
        </div>
      )}
    </div>
  );
}
