import { type Position, posCmp, posEq } from "../buffer/types";

/**
 * Cursor: ponto onde será inserido texto. Anchor: ponto de partida da seleção
 * (igual a `pos` quando não há seleção). `desiredCol` preserva a coluna ao
 * navegar verticalmente em linhas mais curtas (comportamento Monaco/VS Code).
 */
export type Cursor = {
  pos: Position;
  anchor: Position;
  desiredCol: number;
};

export function makeCursor(pos: Position): Cursor {
  return { pos, anchor: pos, desiredCol: pos.col };
}

export function cursorHasSelection(c: Cursor): boolean {
  return !posEq(c.pos, c.anchor);
}

export function cursorRange(c: Cursor) {
  return posCmp(c.anchor, c.pos) <= 0
    ? { start: c.anchor, end: c.pos }
    : { start: c.pos, end: c.anchor };
}

/**
 * Mantém cursors ordenados por posição e remove duplicatas. Necessário após
 * cada operação que mexe em múltiplos cursores ao mesmo tempo, senão duas
 * inserções na mesma posição duplicam o texto.
 */
export function normalizeCursors(cursors: Cursor[]): Cursor[] {
  if (cursors.length <= 1) return cursors;
  const sorted = [...cursors].sort((a, b) => posCmp(a.pos, b.pos));
  const out: Cursor[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1];
    const cur = sorted[i];
    // Funde cursors que terminam no mesmo ponto (seleções sobrepostas).
    if (posEq(prev.pos, cur.pos) && posEq(prev.anchor, cur.anchor)) continue;
    out.push(cur);
  }
  return out;
}
