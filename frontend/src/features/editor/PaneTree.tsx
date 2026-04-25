/**
 * Renderização recursiva da árvore de panes do editor.
 *
 * Usa HTML5 drag-and-drop nativo (consistente com TabBar). Cada leaf desenha
 * um overlay de drop quando há um drag ativo, com 5 zonas (center, left,
 * right, top, bottom) — estilo Ubuntu window-tile.
 */

import { Suspense, lazy, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Breadcrumbs } from "./Breadcrumbs";
import { TabBar } from "./TabBar";
import type { EditorMarker } from "./ProblemsPanel";
import type { DropSide, LeafPane, PaneId, PaneNode, PaneTab } from "./panes";

const CodeEditor = lazy(() =>
  import("./CodeEditor").then((m) => ({ default: m.CodeEditor })),
);

export const FILE_DRAG_MIME = "application/x-adila-file";

export type DraggedFile = { path: string; name: string; fromPaneId?: PaneId };

function ViewFallback() {
  return (
    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
      Carregando…
    </div>
  );
}

type PaneTreeProps = {
  root: PaneNode;
  rootPath: string;
  focusedPaneId: PaneId;
  onFocusPane: (id: PaneId) => void;
  onActivateTab: (paneId: PaneId, path: string) => void;
  onCloseTab: (paneId: PaneId, path: string) => void;
  onReorderTabs: (paneId: PaneId, fromIndex: number, toIndex: number) => void;
  onChange: (path: string, content: string) => void;
  onCursorChange: (line: number, column: number) => void;
  onMarkersChange: (path: string, markers: EditorMarker[]) => void;
  onDropFile: (
    paneId: PaneId,
    side: DropSide,
    file: DraggedFile,
  ) => void;
  onSplitSizeChange?: (splitId: PaneId, size: number) => void;
  onOpenFileByPath: (path: string) => void;
  emptyState: React.ReactNode;
};

export function PaneTree(props: PaneTreeProps) {
  return <PaneNodeView node={props.root} {...props} />;
}

function PaneNodeView({
  node,
  ...props
}: { node: PaneNode } & PaneTreeProps) {
  if (node.kind === "leaf") {
    return <LeafView leaf={node} {...props} />;
  }

  const orientation =
    node.direction === "horizontal" ? "horizontal" : "vertical";
  const idA = `${node.id}-a`;
  const idB = `${node.id}-b`;

  return (
    <ResizablePanelGroup
      orientation={orientation}
      className="flex-1 min-h-0"
      onLayoutChanged={(layout) => {
        const aSize = layout[idA];
        if (typeof aSize === "number" && Math.round(aSize) !== Math.round(node.size)) {
          props.onSplitSizeChange?.(node.id, aSize);
        }
      }}
    >
      <ResizablePanel id={idA} defaultSize={`${node.size}%`} className="flex flex-col overflow-hidden">
        <PaneNodeView node={node.a} {...props} />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id={idB} defaultSize={`${100 - node.size}%`} className="flex flex-col overflow-hidden">
        <PaneNodeView node={node.b} {...props} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function LeafView({
  leaf,
  rootPath,
  focusedPaneId,
  onFocusPane,
  onActivateTab,
  onCloseTab,
  onReorderTabs,
  onChange,
  onCursorChange,
  onMarkersChange,
  onDropFile,
  onOpenFileByPath,
  emptyState,
}: { leaf: LeafPane } & PaneTreeProps) {
  const [dropSide, setDropSide] = useState<DropSide | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFocused = leaf.id === focusedPaneId;

  const activeTab = leaf.tabs.find((t) => t.path === leaf.activePath);

  function isFileDrag(e: React.DragEvent): boolean {
    return Array.from(e.dataTransfer.types).includes(FILE_DRAG_MIME);
  }

  function computeSide(e: React.DragEvent): DropSide {
    const el = containerRef.current;
    if (!el) return "center";
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const EDGE = 0.25;
    // priorize a borda mais próxima
    const distLeft = x;
    const distRight = 1 - x;
    const distTop = y;
    const distBottom = 1 - y;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist > EDGE) return "center";
    if (minDist === distLeft) return "left";
    if (minDist === distRight) return "right";
    if (minDist === distTop) return "top";
    return "bottom";
  }

  function handleDragEnter(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropSide(computeSide(e));
  }

  function handleDragLeave(e: React.DragEvent) {
    // só limpa se sair de fato do container (relatedTarget fora)
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragActive(false);
    setDropSide(null);
  }

  function handleDrop(e: React.DragEvent) {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData(FILE_DRAG_MIME);
    setDragActive(false);
    setDropSide(null);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DraggedFile;
      const side = computeSide(e);
      onDropFile(leaf.id, side, parsed);
    } catch {
      // ignore
    }
  }

  return (
    <div
      ref={containerRef}
      onClick={() => !isFocused && onFocusPane(leaf.id)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col overflow-hidden h-full min-h-0 flex-1"
    >
      {/* TabBar */}
      <div className="flex items-center border-b shrink-0">
        <div className="flex-1 overflow-hidden min-w-0">
          <TabBar
            tabs={leaf.tabs}
            activePath={leaf.activePath}
            paneId={leaf.id}
            onActivate={(path) => onActivateTab(leaf.id, path)}
            onClose={(path) => onCloseTab(leaf.id, path)}
            onReorder={(from, to) => onReorderTabs(leaf.id, from, to)}
          />
        </div>
      </div>

      {/* Breadcrumbs + editor */}
      {activeTab && (
        <Breadcrumbs
          path={activeTab.path}
          rootPath={rootPath}
          onOpenFile={onOpenFileByPath}
        />
      )}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab ? (
          <Suspense fallback={<ViewFallback />}>
            <CodeEditor
              path={activeTab.path}
              content={activeTab.content}
              rootUri={rootPath ? `file://${rootPath}` : undefined}
              onChange={(v) => onChange(activeTab.path, v)}
              onCursorChange={isFocused ? onCursorChange : undefined}
              onMarkersChange={onMarkersChange}
            />
          </Suspense>
        ) : (
          emptyState
        )}
      </div>

      {/* Indicador de pane focado (sutil ring no top do leaf) */}
      {isFocused && leaf.tabs.length > 0 && (
        <span className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-primary/40" />
      )}

      {/* Drop overlay — visível apenas durante drag */}
      {dragActive && <DropOverlay side={dropSide} />}
    </div>
  );
}

function DropOverlay({ side }: { side: DropSide | null }) {
  // Cada zona renderizada com posição absoluta e highlight quando ativa
  const ZONE = 25; // % de cada borda
  const cls = (active: boolean) =>
    [
      "absolute pointer-events-none transition-colors",
      active
        ? "bg-primary/20 border-2 border-primary"
        : "bg-transparent border border-primary/20",
    ].join(" ");

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* center */}
      <div
        className={cls(side === "center")}
        style={{
          top: `${ZONE}%`,
          left: `${ZONE}%`,
          right: `${ZONE}%`,
          bottom: `${ZONE}%`,
        }}
      />
      {/* left */}
      <div
        className={cls(side === "left")}
        style={{ top: 0, bottom: 0, left: 0, width: `${ZONE}%` }}
      />
      {/* right */}
      <div
        className={cls(side === "right")}
        style={{ top: 0, bottom: 0, right: 0, width: `${ZONE}%` }}
      />
      {/* top */}
      <div
        className={cls(side === "top")}
        style={{
          top: 0,
          left: `${ZONE}%`,
          right: `${ZONE}%`,
          height: `${ZONE}%`,
        }}
      />
      {/* bottom */}
      <div
        className={cls(side === "bottom")}
        style={{
          bottom: 0,
          left: `${ZONE}%`,
          right: `${ZONE}%`,
          height: `${ZONE}%`,
        }}
      />
    </div>
  );
}
