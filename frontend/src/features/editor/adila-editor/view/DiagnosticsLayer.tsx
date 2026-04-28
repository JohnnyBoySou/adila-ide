import { memo } from "react";
import type * as proto from "vscode-languageserver-protocol";

type Props = {
  diagnostics: proto.Diagnostic[];
  charWidth: number;
  lineHeight: number;
  paddingLeft: number;
  paddingTop: number;
  firstVisible: number;
  lastVisible: number;
};

/** Renderiza squiggle underlines pra cada diagnostic via SVG inline. */
function DiagnosticsLayerInner({
  diagnostics,
  charWidth,
  lineHeight,
  paddingLeft,
  paddingTop,
  firstVisible,
  lastVisible,
}: Props) {
  const items: React.ReactNode[] = [];

  for (let i = 0; i < diagnostics.length; i++) {
    const d = diagnostics[i];
    const startLine = d.range.start.line;
    const endLine = d.range.end.line;
    if (endLine < firstVisible || startLine > lastVisible) continue;

    // V0: só desenha squiggle na linha inicial. Multi-line é raro nos LSPs
    // típicos pra erros — costuma vir como range single-line do mesmo símbolo.
    const line = startLine;
    if (line < firstVisible || line > lastVisible) continue;

    const sCol = d.range.start.character;
    const eCol = startLine === endLine ? d.range.end.character : sCol + 1;
    const width = Math.max(charWidth, (eCol - sCol) * charWidth);
    const left = paddingLeft + sCol * charWidth;
    const top = paddingTop + line * lineHeight + lineHeight - 4;

    const color = severityColor(d.severity);
    items.push(
      <div
        key={`d${i}`}
        title={d.message}
        style={{
          position: "absolute",
          top,
          left,
          width,
          height: 4,
          pointerEvents: "auto",
          zIndex: 2,
          backgroundImage: `url("data:image/svg+xml;utf8,${squiggleSvg(color)}")`,
          backgroundRepeat: "repeat-x",
        }}
      />,
    );
  }

  return (
    <div
      className="ade-diagnostics-layer"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
    >
      {items}
    </div>
  );
}

function severityColor(sev: number | undefined): string {
  // 1=Error 2=Warning 3=Info 4=Hint (LSP convention)
  if (sev === 1) return "#f48771";
  if (sev === 2) return "#cca700";
  if (sev === 3) return "#75beff";
  return "#888";
}

function squiggleSvg(color: string): string {
  // Onda em zig-zag de 6x4. Encoded inline pra evitar fetch.
  const c = encodeURIComponent(color);
  return `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='4' viewBox='0 0 6 4'><path d='M0 3 Q1.5 0 3 3 T6 3' fill='none' stroke='${c}' stroke-width='1'/></svg>`;
}

export const DiagnosticsLayer = memo(DiagnosticsLayerInner);
