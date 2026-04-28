import type { LineBuffer } from "../buffer/TextBuffer";
import type { Position } from "../buffer/types";

const WORD_RE = /[A-Za-z0-9_]/;

export function isWordChar(c: string): boolean {
  return WORD_RE.test(c);
}

export function moveLeft(buf: LineBuffer, p: Position): Position {
  if (p.col > 0) return { line: p.line, col: p.col - 1 };
  if (p.line > 0) return { line: p.line - 1, col: buf.getLineLength(p.line - 1) };
  return p;
}

export function moveRight(buf: LineBuffer, p: Position): Position {
  const len = buf.getLineLength(p.line);
  if (p.col < len) return { line: p.line, col: p.col + 1 };
  if (p.line < buf.getLineCount() - 1) return { line: p.line + 1, col: 0 };
  return p;
}

/** Skip whitespace then word OR skip non-word chunk — comportamento Monaco. */
export function moveWordLeft(buf: LineBuffer, p: Position): Position {
  let line = p.line;
  let col = p.col;
  if (col === 0) {
    if (line === 0) return p;
    line--;
    col = buf.getLineLength(line);
  }
  const text = buf.getLine(line);
  // skip whitespace à esquerda
  while (col > 0 && /\s/.test(text[col - 1])) col--;
  if (col === 0) return { line, col };
  const isWord = isWordChar(text[col - 1]);
  while (col > 0 && /\s/.test(text[col - 1]) === false && isWordChar(text[col - 1]) === isWord) {
    col--;
  }
  return { line, col };
}

export function moveWordRight(buf: LineBuffer, p: Position): Position {
  let line = p.line;
  let col = p.col;
  const lineLen = buf.getLineLength(line);
  if (col === lineLen) {
    if (line === buf.getLineCount() - 1) return p;
    return { line: line + 1, col: 0 };
  }
  const text = buf.getLine(line);
  // skip não-whitespace primeiro
  if (!/\s/.test(text[col])) {
    const isWord = isWordChar(text[col]);
    while (col < lineLen && !/\s/.test(text[col]) && isWordChar(text[col]) === isWord) {
      col++;
    }
  }
  while (col < lineLen && /\s/.test(text[col])) col++;
  return { line, col };
}

export function moveLineStart(buf: LineBuffer, p: Position): Position {
  // Smart home: primeiro vai pro início do conteúdo, segunda vez vai pra col 0.
  const text = buf.getLine(p.line);
  let firstNonWs = 0;
  while (firstNonWs < text.length && /\s/.test(text[firstNonWs])) firstNonWs++;
  if (p.col !== firstNonWs) return { line: p.line, col: firstNonWs };
  return { line: p.line, col: 0 };
}

export function moveLineEnd(buf: LineBuffer, p: Position): Position {
  return { line: p.line, col: buf.getLineLength(p.line) };
}

export function moveUp(buf: LineBuffer, p: Position, desiredCol: number): Position {
  if (p.line === 0) return { line: 0, col: 0 };
  const newLine = p.line - 1;
  return { line: newLine, col: Math.min(desiredCol, buf.getLineLength(newLine)) };
}

export function moveDown(buf: LineBuffer, p: Position, desiredCol: number): Position {
  if (p.line === buf.getLineCount() - 1) {
    return { line: p.line, col: buf.getLineLength(p.line) };
  }
  const newLine = p.line + 1;
  return { line: newLine, col: Math.min(desiredCol, buf.getLineLength(newLine)) };
}

export function wordRangeAt(buf: LineBuffer, p: Position): { start: Position; end: Position } {
  const text = buf.getLine(p.line);
  if (text.length === 0 || p.col > text.length) {
    return { start: p, end: p };
  }
  const at = Math.min(p.col, text.length - 1);
  if (!isWordChar(text[at] ?? "")) {
    // tenta o caractere à esquerda
    if (at > 0 && isWordChar(text[at - 1])) {
      let s = at - 1;
      while (s > 0 && isWordChar(text[s - 1])) s--;
      return { start: { line: p.line, col: s }, end: { line: p.line, col: at } };
    }
    return { start: p, end: p };
  }
  let s = at;
  while (s > 0 && isWordChar(text[s - 1])) s--;
  let e = at;
  while (e < text.length && isWordChar(text[e])) e++;
  return { start: { line: p.line, col: s }, end: { line: p.line, col: e } };
}
