import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as proto from "vscode-languageserver-protocol";

type Props = {
  actions: proto.CodeAction[];
  anchorX: number;
  anchorY: number;
  lineHeight: number;
  onAccept: (action: proto.CodeAction) => void;
  onClose: () => void;
};

export function CodeActionPopup({
  actions,
  anchorX,
  anchorY,
  lineHeight,
  onAccept,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: anchorX, y: anchorY + lineHeight });
  const [selected, setSelected] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = anchorX;
    let y = anchorY + lineHeight;
    if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
    if (y + rect.height > vh - 8) y = Math.max(8, anchorY - rect.height - 4);
    setPos({ x, y });
  }, [anchorX, anchorY, lineHeight]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % actions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s - 1 + actions.length) % actions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onAccept(actions[selected]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [actions, selected, onAccept, onClose]);

  if (actions.length === 0) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[96] w-[360px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg text-xs animate-in fade-in-0 duration-100"
      style={{ left: pos.x, top: pos.y }}
    >
      {actions.map((action, index) => (
        <button
          type="button"
          key={`${action.title}-${index}`}
          className={`w-full px-2.5 py-1.5 text-left hover:bg-accent hover:text-accent-foreground ${
            selected === index ? "bg-accent text-accent-foreground" : ""
          }`}
          onMouseEnter={() => setSelected(index)}
          onClick={() => onAccept(action)}
        >
          <span className="block truncate">{action.title}</span>
          {action.kind && (
            <span className="block truncate text-[10px] text-muted-foreground">{action.kind}</span>
          )}
        </button>
      ))}
      <div className="border-t border-border/70">
        <button
          type="button"
          className="w-full px-2.5 py-1 text-left text-muted-foreground hover:bg-accent"
          onClick={onClose}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
