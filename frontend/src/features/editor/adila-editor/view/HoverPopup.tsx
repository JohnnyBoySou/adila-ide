import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as proto from "vscode-languageserver-protocol";

type Props = {
  hover: proto.Hover;
  /** Coordenadas em viewport (clientX/Y) onde âncorar o popup. */
  anchorX: number;
  anchorY: number;
  lineHeight: number;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function HoverPopup({
  hover,
  anchorX,
  anchorY,
  lineHeight,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: anchorX, y: anchorY + lineHeight + 4 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = anchorX;
    let y = anchorY + lineHeight + 4;
    if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
    // Se não cabe abaixo, joga acima da linha.
    if (y + rect.height > vh - 8) y = Math.max(8, anchorY - rect.height - 4);
    setPos({ x, y });
  }, [anchorX, anchorY, lineHeight]);

  const text = hoverToString(hover.contents);
  if (!text) return null;

  return (
    <div
      ref={ref}
      className="fixed z-[90] max-w-[600px] max-h-[300px] overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg px-3 py-2 text-xs animate-in fade-in-0 duration-100"
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <pre className="whitespace-pre-wrap font-mono leading-relaxed text-[12px]">{text}</pre>
    </div>
  );
}

function hoverToString(contents: proto.Hover["contents"]): string {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((c) => (typeof c === "string" ? c : c.value))
      .filter(Boolean)
      .join("\n\n");
  }
  if ("kind" in contents) return contents.value;
  return contents.value;
}
