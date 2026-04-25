import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SymbolIcon } from "@/components/SymbolIcon";

type Tab = { path: string; content: string; dirty: boolean };

type Props = {
  tabs: Tab[];
  activePath: string;
  paneId?: string;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function TabBar({ tabs, activePath, paneId, onActivate, onClose, onReorder }: Props) {
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragIndexRef = useRef<number>(-1);

  function handleDragStart(e: React.DragEvent, index: number) {
    dragIndexRef.current = index;
    const tab = tabs[index];
    if (tab && paneId) {
      // permite drop em outro pane via mesmo MIME — payload inclui fromPaneId
      e.dataTransfer.setData(
        "application/x-adila-file",
        JSON.stringify({
          path: tab.path,
          name: tab.path.split(/[\\/]/).pop() || tab.path,
          fromPaneId: paneId,
        }),
      );
      e.dataTransfer.effectAllowed = "copyMove";
    } else {
      e.dataTransfer.effectAllowed = "move";
    }
    // ghost image transparente — a tab em si já dá o feedback visual
    e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 0, 0);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    // só intercepta se for reorder dentro deste TabBar — caso contrário deixa
    // bubble para LeafView (drop entre panes)
    if (dragIndexRef.current === -1) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(index);
  }

  function handleDrop(e: React.DragEvent, toIndex: number) {
    const from = dragIndexRef.current;
    if (from === -1) return; // não é reorder local — deixa LeafView tratar
    e.preventDefault();
    if (from !== toIndex) {
      onReorder(from, toIndex);
    }
    setDragOver(null);
    dragIndexRef.current = -1;
  }

  function handleDragEnd() {
    setDragOver(null);
    dragIndexRef.current = -1;
  }

  return (
    <div
      className="flex border-b overflow-x-auto bg-muted/30 shrink-0"
      onDragLeave={() => setDragOver(null)}
    >
      {tabs.map((t, i) => {
        const name = t.path.split(/[\\/]/).pop() || t.path;
        const active = t.path === activePath;
        const isDragging = dragIndexRef.current === i;
        const isDropTarget = dragOver === i && dragIndexRef.current !== i;

        return (
          <div
            key={t.path}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={handleDragEnd}
            onClick={() => onActivate(t.path)}
            className={cn(
              "relative flex items-center gap-2 px-3 py-1.5 border-r text-sm cursor-pointer select-none shrink-0 transition-colors",
              active ? "bg-background" : "hover:bg-accent",
              isDragging && "opacity-40",
              isDropTarget && "bg-accent/60",
            )}
          >
            {/* indicador de drop à esquerda */}
            {isDropTarget && (
              <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-full" />
            )}

            <SymbolIcon name={name} isDir={false} className="size-4 shrink-0" />
            <span className="truncate max-w-[12rem]">
              {name}
              {t.dirty && <span className="ml-1 text-primary">•</span>}
            </span>

            <button
              onClick={(ev) => { ev.stopPropagation(); onClose(t.path); }}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Fechar aba"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
