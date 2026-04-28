/**
 * TextBuffer — interface única do buffer.
 *
 * V0 implementa com array de linhas (LineBuffer). A interface foi desenhada
 * para que possa ser trocada por piece-table/rope no futuro sem alterar
 * a view.
 */

import { type Position, type Range, normalizeRange, posCmp } from "./types";

export interface TextBuffer {
  getLineCount(): number;
  getLine(line: number): string;
  getLineLength(line: number): number;
  getValue(): string;
  setValue(text: string): void;

  insert(pos: Position, text: string): Range;
  remove(range: Range): string;
  replace(range: Range, text: string): Range;

  offsetAt(pos: Position): number;
  positionAt(offset: number): Position;

  getRangeText(range: Range): string;
}

export class LineBuffer implements TextBuffer {
  private lines: string[];
  // Tracking de versão útil pra invalidar caches (tokenização, decorações).
  private version = 0;

  constructor(text: string = "") {
    this.lines = text.length === 0 ? [""] : text.split("\n");
  }

  getVersion(): number {
    return this.version;
  }

  getLineCount(): number {
    return this.lines.length;
  }

  getLine(line: number): string {
    return this.lines[line] ?? "";
  }

  getLineLength(line: number): number {
    return this.lines[line]?.length ?? 0;
  }

  getValue(): string {
    return this.lines.join("\n");
  }

  setValue(text: string): void {
    this.lines = text.length === 0 ? [""] : text.split("\n");
    this.version++;
  }

  insert(pos: Position, text: string): Range {
    const clamped = this.clamp(pos);
    if (text.length === 0) return { start: clamped, end: clamped };

    const line = this.lines[clamped.line];
    const before = line.slice(0, clamped.col);
    const after = line.slice(clamped.col);

    const inserted = text.split("\n");
    if (inserted.length === 1) {
      this.lines[clamped.line] = before + inserted[0] + after;
      this.version++;
      return {
        start: clamped,
        end: { line: clamped.line, col: clamped.col + inserted[0].length },
      };
    }

    const first = before + inserted[0];
    const last = inserted[inserted.length - 1] + after;
    const middle = inserted.slice(1, -1);

    this.lines.splice(clamped.line, 1, first, ...middle, last);
    this.version++;

    return {
      start: clamped,
      end: {
        line: clamped.line + inserted.length - 1,
        col: inserted[inserted.length - 1].length,
      },
    };
  }

  remove(range: Range): string {
    const norm = normalizeRange(range);
    const start = this.clamp(norm.start);
    const end = this.clamp(norm.end);
    if (posCmp(start, end) === 0) return "";

    if (start.line === end.line) {
      const line = this.lines[start.line];
      const removed = line.slice(start.col, end.col);
      this.lines[start.line] = line.slice(0, start.col) + line.slice(end.col);
      this.version++;
      return removed;
    }

    const startLine = this.lines[start.line];
    const endLine = this.lines[end.line];

    const removedFirst = startLine.slice(start.col);
    const removedLast = endLine.slice(0, end.col);
    const removedMiddle = this.lines.slice(start.line + 1, end.line);
    const removed =
      removedFirst +
      "\n" +
      (removedMiddle.length > 0 ? removedMiddle.join("\n") + "\n" : "") +
      removedLast;

    const merged = startLine.slice(0, start.col) + endLine.slice(end.col);
    this.lines.splice(start.line, end.line - start.line + 1, merged);
    this.version++;
    return removed;
  }

  replace(range: Range, text: string): Range {
    this.remove(range);
    return this.insert(normalizeRange(range).start, text);
  }

  offsetAt(pos: Position): number {
    const clamped = this.clamp(pos);
    let off = 0;
    for (let i = 0; i < clamped.line; i++) {
      off += this.lines[i].length + 1;
    }
    return off + clamped.col;
  }

  positionAt(offset: number): Position {
    let remaining = Math.max(0, offset);
    for (let i = 0; i < this.lines.length; i++) {
      const len = this.lines[i].length;
      if (remaining <= len) {
        return { line: i, col: remaining };
      }
      remaining -= len + 1;
    }
    const last = this.lines.length - 1;
    return { line: last, col: this.lines[last].length };
  }

  getRangeText(range: Range): string {
    const norm = normalizeRange(range);
    const start = this.clamp(norm.start);
    const end = this.clamp(norm.end);
    if (posCmp(start, end) === 0) return "";

    if (start.line === end.line) {
      return this.lines[start.line].slice(start.col, end.col);
    }
    const out: string[] = [this.lines[start.line].slice(start.col)];
    for (let i = start.line + 1; i < end.line; i++) {
      out.push(this.lines[i]);
    }
    out.push(this.lines[end.line].slice(0, end.col));
    return out.join("\n");
  }

  clamp(pos: Position): Position {
    if (this.lines.length === 0) return { line: 0, col: 0 };
    const line = Math.max(0, Math.min(pos.line, this.lines.length - 1));
    const col = Math.max(0, Math.min(pos.col, this.lines[line].length));
    return { line, col };
  }
}
