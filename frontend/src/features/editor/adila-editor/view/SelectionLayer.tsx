import { memo } from "react";
import type { Cursor } from "../cursor/cursorState";
import { cursorRange, cursorHasSelection } from "../cursor/cursorState";
import type { LineBuffer } from "../buffer/TextBuffer";
import type { Range } from "../buffer/types";

type Props = {
  cursors: Cursor[];
  buffer: LineBuffer;
  charWidth: number;
  lineHeight: number;
  paddingLeft: number;
  paddingTop: number;
  findMatches?: Range[];
  findIndex?: number;
};

/** Desenha retângulos para cada linha de cada seleção, mais cursors. */
function SelectionLayerInner({
  cursors,
  buffer,
  charWidth,
  lineHeight,
  paddingLeft,
  paddingTop,
  findMatches,
  findIndex,
}: Props) {
  const rects: React.ReactNode[] = [];
  const carets: React.ReactNode[] = [];

  // Find highlights primeiro (atrás da seleção).
  if (findMatches && findMatches.length > 0) {
    for (let i = 0; i < findMatches.length; i++) {
      const m = findMatches[i];
      pushSelectionRects(
        rects,
        m,
        buffer,
        charWidth,
        lineHeight,
        paddingLeft,
        paddingTop,
        i === findIndex ? "find-current" : "find-match",
        `f${i}`,
      );
    }
  }

  cursors.forEach((c, idx) => {
    if (cursorHasSelection(c)) {
      pushSelectionRects(
        rects,
        cursorRange(c),
        buffer,
        charWidth,
        lineHeight,
        paddingLeft,
        paddingTop,
        "selection",
        `s${idx}`,
      );
    }
    const top = paddingTop + c.pos.line * lineHeight;
    const left = paddingLeft + c.pos.col * charWidth;
    carets.push(
      <span
        key={`c${idx}`}
        className="ade-caret"
        style={{
          position: "absolute",
          top,
          left,
          height: lineHeight,
          width: 2,
        }}
      />,
    );
  });

  return (
    <>
      <div className="ade-selection-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        {rects}
      </div>
      <div className="ade-caret-layer" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
        {carets}
      </div>
    </>
  );
}

function pushSelectionRects(
  out: React.ReactNode[],
  range: Range,
  buffer: LineBuffer,
  charWidth: number,
  lineHeight: number,
  paddingLeft: number,
  paddingTop: number,
  cls: string,
  keyPrefix: string,
) {
  const { start, end } = range;
  for (let line = start.line; line <= end.line; line++) {
    const sCol = line === start.line ? start.col : 0;
    const eCol = line === end.line ? end.col : buffer.getLineLength(line) + 1;
    const left = paddingLeft + sCol * charWidth;
    const width = Math.max(2, (eCol - sCol) * charWidth);
    out.push(
      <span
        key={`${keyPrefix}_${line}`}
        className={`ade-${cls}`}
        style={{
          position: "absolute",
          top: paddingTop + line * lineHeight,
          left,
          width,
          height: lineHeight,
        }}
      />,
    );
  }
}

export const SelectionLayer = memo(SelectionLayerInner);
