/**
 * EditorView — núcleo de renderização. Estrutura:
 *
 *  ┌──────────────────────────────────────────┐
 *  │ scroll container (rolagem v + h)         │
 *  │  ┌─────┬───────────────────────────────┐ │
 *  │  │ gut │ content (linhas + overlays)  │ │
 *  │  │ ter │                              │ │
 *  │  └─────┴───────────────────────────────┘ │
 *  └──────────────────────────────────────────┘
 *
 * Linhas renderizadas via janela virtual: só linhas visíveis (+ overscan)
 * existem no DOM. Cursor/seleção desenhados por overlay absoluto.
 *
 * Input: textarea invisível posicionado no caret pra capturar IME e
 * paste/copy nativo. Os events sobem pro store.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import type { Position } from "../buffer/types";
import { posCmp } from "../buffer/types";
import { cursorRange, cursorHasSelection, makeCursor } from "../cursor/cursorState";
import {
  moveDown,
  moveLeft,
  moveLineEnd,
  moveLineStart,
  moveRight,
  moveUp,
  moveWordLeft,
  moveWordRight,
  wordRangeAt,
} from "../cursor/movement";
import type { EditorStore } from "../state/editorStore";
import { LineRow } from "./LineRow";
import { Minimap } from "./Minimap";
import { SelectionLayer } from "./SelectionLayer";
import { DiagnosticsLayer } from "./DiagnosticsLayer";
import { HoverPopup } from "./HoverPopup";
import { CompletionPopup } from "./CompletionPopup";
import type { LspApi } from "../lsp/useAdilaLSP";
import type * as proto from "vscode-languageserver-protocol";
import { measureCharWidth } from "./metrics";

const PADDING_TOP = 8;
const GUTTER_PADDING_X = 12;
const GUTTER_MIN_DIGITS = 2;
const OVERSCAN = 6;

type Props = {
  store: EditorStore;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  showLineNumbers: boolean;
  relativeLineNumbers: boolean;
  highlightCurrentLine: boolean;
  wordWrap: boolean;
  tabSize: number;
  caretBlink: boolean;
  smoothScroll: boolean;
  showMinimap?: boolean;
  readOnly: boolean;
  diagnostics?: proto.Diagnostic[];
  lspApi?: LspApi;
  onCursorChange?: (line: number, col: number) => void;
  onChange?: (value: string) => void;
};

const MINIMAP_WIDTH = 100;

export function EditorView({
  store,
  fontFamily,
  fontSize,
  lineHeight,
  showLineNumbers,
  relativeLineNumbers,
  highlightCurrentLine,
  wordWrap: _wordWrap, // V0: line wrapping não implementado, ignorado por enquanto
  tabSize,
  caretBlink,
  smoothScroll,
  showMinimap = false,
  readOnly,
  diagnostics,
  lspApi,
  onCursorChange,
  onChange,
}: Props) {
  const state = useStore(store);
  const { buffer, cursors, version, langId, tokenCache, findMatches, findIndex } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const charWidth = useMemo(() => measureCharWidth(fontFamily, fontSize), [fontFamily, fontSize]);
  const lineCount = buffer.getLineCount();
  const totalHeight = lineCount * lineHeight + PADDING_TOP * 2;

  // Largura do gutter ajusta com nº de dígitos do total de linhas.
  const gutterDigits = Math.max(GUTTER_MIN_DIGITS, String(lineCount).length);
  const gutterWidth = showLineNumbers ? gutterDigits * charWidth + GUTTER_PADDING_X * 2 : 0;

  // Largura do conteúdo: linha mais longa visível (aproximação O(visible)).
  const [contentWidth, setContentWidth] = useState(0);

  // Tokenização incremental até o limite visível.
  const scrollTop = state.scrollTop;
  const firstVisible = Math.max(0, Math.floor((scrollTop - PADDING_TOP) / lineHeight) - OVERSCAN);
  const visibleCount = Math.ceil(viewport.height / lineHeight) + OVERSCAN * 2;
  const lastVisible = Math.min(lineCount - 1, firstVisible + visibleCount);

  tokenCache.tokenizeUpTo((i) => buffer.getLine(i), lineCount, lastVisible, langId);

  // Calcula contentWidth baseado em linhas visíveis (mais barato que escanear tudo).
  useEffect(() => {
    let max = 0;
    for (let i = firstVisible; i <= lastVisible; i++) {
      const len = buffer.getLineLength(i);
      if (len > max) max = len;
    }
    const target = Math.max(viewport.width, max * charWidth + 64);
    setContentWidth(target);
  }, [buffer, firstVisible, lastVisible, charWidth, viewport.width, version]);

  // Resize observer.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reporta cursor primário para o host.
  const primary = cursors[0];
  useEffect(() => {
    if (primary) onCursorChange?.(primary.pos.line + 1, primary.pos.col + 1);
  }, [primary, onCursorChange]);

  // Reporta valor para o host quando o version muda. Evita ciclo: se a
  // mudança veio de fora (setValue), o version foi incrementado mas não
  // queremos disparar onChange com o mesmo valor.
  const lastReportedRef = useRef<{ version: number; value: string }>({ version: 0, value: "" });
  useEffect(() => {
    if (version === lastReportedRef.current.version) return;
    const value = buffer.getValue();
    if (value !== lastReportedRef.current.value) {
      lastReportedRef.current = { version, value };
      onChange?.(value);
    }
  }, [version, buffer, onChange]);

  // Garante que o cursor primário fica visível ao mover. Sem margem de
  // "leitura" — só rola quando o cursor sai da área visível, evitando que
  // o conteúdo "suba" criando espaço vazio embaixo ao digitar perto do fim.
  useLayoutEffect(() => {
    if (!primary || !scrollerRef.current) return;
    const el = scrollerRef.current;
    const top = primary.pos.line * lineHeight + PADDING_TOP;
    const left = primary.pos.col * charWidth;
    const maxScrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (top + lineHeight > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.min(maxScrollTop, top + lineHeight - el.clientHeight);
    }
    if (left < el.scrollLeft) el.scrollLeft = left;
    else if (left + charWidth > el.scrollLeft + el.clientWidth - gutterWidth - 16) {
      el.scrollLeft = left + charWidth - el.clientWidth + gutterWidth + 16;
    }
  }, [primary, lineHeight, charWidth, gutterWidth]);

  // Foco automático no textarea quando o container recebe click.
  function focusTextarea() {
    textareaRef.current?.focus({ preventScroll: true });
  }

  // Cursor → posição → reposiciona textarea (importante pro IME).
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !primary) return;
    const top = PADDING_TOP + primary.pos.line * lineHeight;
    const left = gutterWidth + primary.pos.col * charWidth;
    ta.style.top = `${top}px`;
    ta.style.left = `${left}px`;
  }, [primary, lineHeight, charWidth, gutterWidth]);

  // Mouse → posição (col baseada em charWidth).
  function pointerToPos(clientX: number, clientY: number): Position {
    const el = scrollerRef.current;
    if (!el) return { line: 0, col: 0 };
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left + el.scrollLeft - gutterWidth - 4;
    const y = clientY - rect.top + el.scrollTop - PADDING_TOP;
    const line = Math.max(0, Math.min(lineCount - 1, Math.floor(y / lineHeight)));
    const col = Math.max(0, Math.round(x / charWidth));
    const lineLen = buffer.getLineLength(line);
    return { line, col: Math.min(col, lineLen) };
  }

  const dragRef = useRef<{ anchor: Position; mode: "char" | "word" | "line" } | null>(null);

  // Hover LSP — debounce mouse-move por 350ms, cancela se o mouse sai do
  // container ou move pra outro identificador.
  const [hoverState, setHoverState] = useState<{
    hover: proto.Hover;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverPosRef = useRef<Position | null>(null);
  const hoverOverPopupRef = useRef(false);

  function clearHover() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (!hoverOverPopupRef.current) {
      setHoverState(null);
      hoverPosRef.current = null;
    }
  }

  // Completion popup state
  const [completionState, setCompletionState] = useState<{
    items: proto.CompletionItem[];
    /** Posição (col) onde começou o filter no buffer. */
    triggerLine: number;
    triggerCol: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  /** Texto digitado entre triggerCol e cursor atual — usado pra filtrar. */
  function completionFilter(): string {
    if (!completionState || !primary) return "";
    if (primary.pos.line !== completionState.triggerLine) return "";
    const line = buffer.getLine(primary.pos.line);
    return line.slice(completionState.triggerCol, primary.pos.col);
  }

  async function triggerCompletion() {
    if (!lspApi?.available || !primary) return;
    const items = await lspApi.completion(primary.pos.line, primary.pos.col);
    if (items.length === 0) return;
    // triggerCol = início do identificador antes do cursor.
    const line = buffer.getLine(primary.pos.line);
    let col = primary.pos.col;
    while (col > 0 && /[\w]/.test(line[col - 1] ?? "")) col--;
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorX = rect.left - el.scrollLeft + gutterWidth + 4 + col * charWidth;
    const anchorY = rect.top - el.scrollTop + PADDING_TOP + primary.pos.line * lineHeight;
    setCompletionState({
      items,
      triggerLine: primary.pos.line,
      triggerCol: col,
      anchorX,
      anchorY,
    });
  }

  function acceptCompletion(item: proto.CompletionItem) {
    if (!completionState || !primary) return;
    const insertText = item.insertText ?? (item.label as string);
    // Substitui [triggerCol, primary.pos.col] pelo insertText.
    const range = {
      start: { line: completionState.triggerLine, col: completionState.triggerCol },
      end: { line: primary.pos.line, col: primary.pos.col },
    };
    const finalCol = completionState.triggerCol + insertText.length;
    store.getState().edit(
      [{ range, text: insertText }],
      [
        {
          pos: { line: completionState.triggerLine, col: finalCol },
          anchor: { line: completionState.triggerLine, col: finalCol },
          desiredCol: finalCol,
        },
      ],
      "completion",
    );
    setCompletionState(null);
  }

  function scheduleHover(clientX: number, clientY: number) {
    if (!lspApi?.available) return;
    const pos = pointerToPos(clientX, clientY);
    // Não dispara se mesma posição.
    const last = hoverPosRef.current;
    if (last && last.line === pos.line && last.col === pos.col) return;

    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(async () => {
      hoverTimerRef.current = null;
      const result = await lspApi.hover(pos.line, pos.col);
      if (!result) {
        setHoverState(null);
        return;
      }
      hoverPosRef.current = pos;
      // Âncora: posição em screen do início do range (ou da posição atual).
      const el = scrollerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const anchorLine = result.range?.start.line ?? pos.line;
      const anchorCol = result.range?.start.character ?? pos.col;
      const anchorX =
        rect.left - el.scrollLeft + gutterWidth + 4 + anchorCol * charWidth;
      const anchorY = rect.top - el.scrollTop + PADDING_TOP + anchorLine * lineHeight;
      setHoverState({ hover: result, anchorX, anchorY });
    }, 350);
  }

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    focusTextarea();
    const pos = pointerToPos(e.clientX, e.clientY);

    if (e.altKey) {
      // Alt+click: adiciona cursor.
      store.getState().setCursors([
        ...cursors,
        makeCursor(pos),
      ]);
      return;
    }

    if (e.detail === 2) {
      // double-click: word
      const r = wordRangeAt(buffer, pos);
      store.getState().setCursors([{ pos: r.end, anchor: r.start, desiredCol: r.end.col }]);
      dragRef.current = { anchor: r.start, mode: "word" };
      return;
    }
    if (e.detail >= 3) {
      // triple-click: line
      const start: Position = { line: pos.line, col: 0 };
      const end: Position =
        pos.line < lineCount - 1
          ? { line: pos.line + 1, col: 0 }
          : { line: pos.line, col: buffer.getLineLength(pos.line) };
      store.getState().setCursors([{ pos: end, anchor: start, desiredCol: end.col }]);
      dragRef.current = { anchor: start, mode: "line" };
      return;
    }

    const anchor = e.shiftKey && primary ? primary.anchor : pos;
    store.getState().setCursors([{ pos, anchor, desiredCol: pos.col }]);
    dragRef.current = { anchor, mode: "char" };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) {
      // Sem drag: agenda hover LSP.
      scheduleHover(e.clientX, e.clientY);
      return;
    }
    const pos = pointerToPos(e.clientX, e.clientY);
    const drag = dragRef.current;
    if (drag.mode === "char") {
      store.getState().setCursors([{ pos, anchor: drag.anchor, desiredCol: pos.col }]);
    } else if (drag.mode === "word") {
      const r = wordRangeAt(buffer, pos);
      const useStart = posCmp(pos, drag.anchor) < 0;
      store.getState().setCursors([
        useStart
          ? { pos: r.start, anchor: drag.anchor, desiredCol: r.start.col }
          : { pos: r.end, anchor: drag.anchor, desiredCol: r.end.col },
      ]);
    } else if (drag.mode === "line") {
      const useStart = posCmp(pos, drag.anchor) < 0;
      const target: Position = useStart
        ? { line: pos.line, col: 0 }
        : pos.line < lineCount - 1
          ? { line: pos.line + 1, col: 0 }
          : { line: pos.line, col: buffer.getLineLength(pos.line) };
      store.getState().setCursors([{ pos: target, anchor: drag.anchor, desiredCol: target.col }]);
    }
  }

  function onMouseUp() {
    dragRef.current = null;
  }

  // Keyboard handler central. Roda no textarea (que tem foco) — nada chega
  // se outro elemento estiver focado.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const s = store.getState();
    const meta = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Ctrl+Space: trigger completion manualmente
    if (meta && e.key === " ") {
      e.preventDefault();
      void triggerCompletion();
      return;
    }

    // Movement
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const newPos = meta ? moveWordLeft(buffer, c.pos) : moveLeft(buffer, c.pos);
        return {
          pos: newPos,
          anchor: shift ? c.anchor : newPos,
          desiredCol: newPos.col,
        };
      });
      s.setCursors(next);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const newPos = meta ? moveWordRight(buffer, c.pos) : moveRight(buffer, c.pos);
        return {
          pos: newPos,
          anchor: shift ? c.anchor : newPos,
          desiredCol: newPos.col,
        };
      });
      s.setCursors(next);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const newPos = moveUp(buffer, c.pos, c.desiredCol);
        return { pos: newPos, anchor: shift ? c.anchor : newPos, desiredCol: c.desiredCol };
      });
      s.setCursors(next);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const newPos = moveDown(buffer, c.pos, c.desiredCol);
        return { pos: newPos, anchor: shift ? c.anchor : newPos, desiredCol: c.desiredCol };
      });
      s.setCursors(next);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const newPos = meta ? { line: 0, col: 0 } : moveLineStart(buffer, c.pos);
        return { pos: newPos, anchor: shift ? c.anchor : newPos, desiredCol: newPos.col };
      });
      s.setCursors(next);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const newPos = meta
          ? { line: lineCount - 1, col: buffer.getLineLength(lineCount - 1) }
          : moveLineEnd(buffer, c.pos);
        return { pos: newPos, anchor: shift ? c.anchor : newPos, desiredCol: newPos.col };
      });
      s.setCursors(next);
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const dir = e.key === "PageDown" ? 1 : -1;
      const visibleLines = Math.max(1, Math.floor(viewport.height / lineHeight) - 1);
      const next = s.cursors.map((c) => {
        const targetLine = Math.max(0, Math.min(lineCount - 1, c.pos.line + dir * visibleLines));
        const newPos: Position = {
          line: targetLine,
          col: Math.min(c.desiredCol, buffer.getLineLength(targetLine)),
        };
        return { pos: newPos, anchor: shift ? c.anchor : newPos, desiredCol: c.desiredCol };
      });
      s.setCursors(next);
      return;
    }

    // Edit
    if (readOnly) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      s.deleteSelectionOrChar("back");
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      s.deleteSelectionOrChar("forward");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // Auto-indent simples: replica indent da linha atual.
      const c = s.cursors[0];
      const text = buffer.getLine(c.pos.line);
      let indent = "";
      for (const ch of text) {
        if (ch === " " || ch === "\t") indent += ch;
        else break;
      }
      s.insertText("\n" + indent);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      s.insertText(" ".repeat(tabSize));
      return;
    }

    // Shortcuts
    if (meta && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (shift) s.redo();
      else s.undo();
      return;
    }
    if (meta && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      s.redo();
      return;
    }
    if (meta && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      const lastLine = lineCount - 1;
      s.setCursors([
        {
          pos: { line: lastLine, col: buffer.getLineLength(lastLine) },
          anchor: { line: 0, col: 0 },
          desiredCol: buffer.getLineLength(lastLine),
        },
      ]);
      return;
    }
    if (meta && (e.key === "d" || e.key === "D")) {
      // Adiciona próxima ocorrência da palavra/seleção atual ao multi-cursor.
      e.preventDefault();
      addNextOccurrence(s);
      return;
    }
    if (meta && (e.key === "l" || e.key === "L")) {
      // Seleciona linha inteira.
      e.preventDefault();
      const next = s.cursors.map((c) => {
        const start: Position = { line: c.pos.line, col: 0 };
        const end: Position =
          c.pos.line < lineCount - 1
            ? { line: c.pos.line + 1, col: 0 }
            : { line: c.pos.line, col: buffer.getLineLength(c.pos.line) };
        return { pos: end, anchor: start, desiredCol: end.col };
      });
      s.setCursors(next);
      return;
    }
    if (meta && e.key === "/") {
      // Toggle line comment.
      e.preventDefault();
      toggleLineComment(s);
      return;
    }
    if (e.key === "Escape") {
      // Reduz a 1 cursor (descarta multi-cursor).
      if (s.cursors.length > 1) {
        e.preventDefault();
        s.setCursors([s.cursors[0]]);
      }
      return;
    }

    // Caracteres imprimíveis caem no onInput do textarea (cobre IME também).
  }

  function onInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const v = ta.value;
    if (v.length === 0) return;
    ta.value = "";
    if (readOnly) return;
    store.getState().insertText(v);
    // Auto-trigger completion no ponto, ou refresh se já aberto.
    const lastChar = v[v.length - 1];
    if (lastChar === "." || lastChar === ":") {
      void triggerCompletion();
    }
  }

  async function onCopy(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const s = store.getState();
    const parts = s.cursors.map((c) =>
      cursorHasSelection(c) ? buffer.getRangeText(cursorRange(c)) : buffer.getLine(c.pos.line),
    );
    e.clipboardData.setData("text/plain", parts.join("\n"));
  }

  function onCut(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    e.preventDefault();
    const s = store.getState();
    const parts = s.cursors.map((c) =>
      cursorHasSelection(c) ? buffer.getRangeText(cursorRange(c)) : buffer.getLine(c.pos.line),
    );
    e.clipboardData.setData("text/plain", parts.join("\n"));
    // Se nenhum cursor tem seleção, remove a linha inteira.
    if (s.cursors.every((c) => !cursorHasSelection(c))) {
      // Delete linha
      const ops = s.cursors.map((c) => {
        const startLine = c.pos.line;
        const start: Position = { line: startLine, col: 0 };
        const end: Position =
          startLine < lineCount - 1
            ? { line: startLine + 1, col: 0 }
            : { line: startLine, col: buffer.getLineLength(startLine) };
        return { range: { start, end }, text: "" };
      });
      const next = s.cursors.map((c) => ({
        pos: { line: c.pos.line, col: 0 },
        anchor: { line: c.pos.line, col: 0 },
        desiredCol: 0,
      }));
      s.edit(ops, next, "cut-line");
      return;
    }
    s.deleteSelectionOrChar("back");
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const s = store.getState();
    // Se nº de linhas do clipboard == nº de cursors, aplica linha-a-linha.
    const lines = text.split("\n");
    if (lines.length === s.cursors.length && s.cursors.length > 1) {
      const ops = s.cursors.map((c, i) => ({ range: cursorRange(c), text: lines[i] }));
      const next = s.cursors.map((c, i) => {
        const r = cursorRange(c);
        const newCol = r.start.col + lines[i].length;
        return { pos: { line: r.start.line, col: newCol }, anchor: { line: r.start.line, col: newCol }, desiredCol: newCol };
      });
      s.edit(ops, next, "paste-multi");
      return;
    }
    s.insertText(text);
  }

  // Render
  const rows: React.ReactNode[] = [];
  for (let i = firstVisible; i <= lastVisible; i++) {
    const top = PADDING_TOP + i * lineHeight;
    rows.push(
      <div
        key={i}
        className="ade-line"
        style={{
          position: "absolute",
          top,
          left: 0,
          right: 0,
          height: lineHeight,
          paddingLeft: 4,
          whiteSpace: "pre",
          fontVariantLigatures: "common-ligatures",
          zIndex: 2,
        }}
      >
        <LineRow text={buffer.getLine(i)} tokens={tokenCache.getLineTokens(i)} />
      </div>,
    );
  }

  // Linha atual destacada.
  const currentLineTop = primary ? PADDING_TOP + primary.pos.line * lineHeight : -9999;

  // Gutter rows (line numbers).
  const gutterRows: React.ReactNode[] = [];
  if (showLineNumbers) {
    for (let i = firstVisible; i <= lastVisible; i++) {
      const top = PADDING_TOP + i * lineHeight;
      const num = relativeLineNumbers && primary
        ? i === primary.pos.line
          ? i + 1
          : Math.abs(i - primary.pos.line)
        : i + 1;
      const isCurrent = primary && i === primary.pos.line;
      gutterRows.push(
        <div
          key={i}
          className={`ade-gutter-row${isCurrent ? " ade-gutter-current" : ""}`}
          style={{
            position: "absolute",
            top,
            left: 0,
            right: GUTTER_PADDING_X,
            height: lineHeight,
            textAlign: "right",
            paddingRight: GUTTER_PADDING_X,
            fontFamily,
            fontSize,
            lineHeight: `${lineHeight}px`,
          }}
        >
          {num}
        </div>,
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className={`ade-root${caretBlink ? " ade-caret-blink" : ""}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        fontFamily,
        fontSize,
        lineHeight: `${lineHeight}px`,
        cursor: "text",
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={clearHover}
    >
      <div
        ref={scrollerRef}
        className="ade-scroller"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: showMinimap ? MINIMAP_WIDTH : 0,
          overflow: "auto",
          scrollBehavior: smoothScroll ? "smooth" : "auto",
        }}
        onScroll={(e) => {
          const el = e.currentTarget;
          store.getState().setScroll(el.scrollTop, el.scrollLeft);
        }}
      >
        <div
          style={{
            position: "relative",
            width: gutterWidth + contentWidth,
            height: totalHeight,
          }}
        >
          {/* current line bg */}
          {highlightCurrentLine && primary && (
            <div
              className="ade-current-line"
              style={{
                position: "absolute",
                top: currentLineTop,
                left: 0,
                width: "100%",
                height: lineHeight,
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
          )}

          {/* gutter */}
          {showLineNumbers && (
            <div
              className="ade-gutter"
              style={{
                position: "sticky",
                left: 0,
                top: 0,
                width: gutterWidth,
                height: totalHeight,
                float: "left",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              {gutterRows}
            </div>
          )}

          {/* área de texto: deslocada pra direita do gutter */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: gutterWidth,
              right: 0,
              height: totalHeight,
            }}
          >
            {rows}
            <SelectionLayer
              cursors={cursors}
              buffer={buffer}
              charWidth={charWidth}
              lineHeight={lineHeight}
              paddingLeft={4}
              paddingTop={PADDING_TOP}
              findMatches={findMatches}
              findIndex={findIndex}
            />
            {diagnostics && diagnostics.length > 0 && (
              <DiagnosticsLayer
                diagnostics={diagnostics}
                charWidth={charWidth}
                lineHeight={lineHeight}
                paddingLeft={4}
                paddingTop={PADDING_TOP}
                firstVisible={firstVisible}
                lastVisible={lastVisible}
              />
            )}
          </div>
        </div>
      </div>

      {showMinimap && viewport.height > 0 && (
        <Minimap
          buffer={buffer}
          tokenCache={tokenCache}
          langId={langId}
          bufferVersion={version}
          width={MINIMAP_WIDTH}
          scrollTop={state.scrollTop}
          viewportHeight={viewport.height}
          contentHeight={totalHeight}
          editorLineHeight={lineHeight}
          onScrollTo={(top) => {
            const el = scrollerRef.current;
            if (el) el.scrollTop = top;
          }}
        />
      )}

      <textarea
        ref={textareaRef}
        className="ade-input"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onInput={onInput}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        style={{
          position: "absolute",
          width: 1,
          height: lineHeight,
          opacity: 0,
          padding: 0,
          border: 0,
          outline: "none",
          resize: "none",
          zIndex: 3,
          pointerEvents: "none",
        }}
      />
      {hoverState && (
        <HoverPopup
          hover={hoverState.hover}
          anchorX={hoverState.anchorX}
          anchorY={hoverState.anchorY}
          lineHeight={lineHeight}
          onMouseEnter={() => {
            hoverOverPopupRef.current = true;
          }}
          onMouseLeave={() => {
            hoverOverPopupRef.current = false;
            setHoverState(null);
            hoverPosRef.current = null;
          }}
        />
      )}
      {completionState && (
        <CompletionPopup
          items={completionState.items}
          filter={completionFilter()}
          anchorX={completionState.anchorX}
          anchorY={completionState.anchorY}
          lineHeight={lineHeight}
          onAccept={acceptCompletion}
          onClose={() => setCompletionState(null)}
        />
      )}
    </div>
  );
}

function addNextOccurrence(s: ReturnType<EditorStore["getState"]>) {
  const buf = s.buffer;
  const last = s.cursors[s.cursors.length - 1];
  const range = cursorHasSelection(last)
    ? cursorRange(last)
    : wordRangeAt(buf, last.pos);
  if (range.start.line !== range.end.line) return; // V0: só palavra/seleção single-line
  const needle = buf.getRangeText(range);
  if (!needle) return;
  const startOff = buf.offsetAt(range.end);
  const text = buf.getValue();
  const idx = text.indexOf(needle, startOff);
  const finalIdx = idx === -1 ? text.indexOf(needle) : idx;
  if (finalIdx === -1) return;
  const startPos = buf.positionAt(finalIdx);
  const endPos = buf.positionAt(finalIdx + needle.length);
  s.setCursors([...s.cursors, { pos: endPos, anchor: startPos, desiredCol: endPos.col }]);
}

function toggleLineComment(s: ReturnType<EditorStore["getState"]>) {
  const buf = s.buffer;
  const lang = s.langId;
  // Importação dinâmica seria overkill aqui — usa map local conhecido.
  const lineCommentMap: Record<string, string> = {
    typescript: "// ", javascript: "// ", go: "// ", rust: "// ",
    python: "# ", shell: "# ", scss: "// ", json: "// ",
  };
  const prefix = lineCommentMap[lang] ?? "// ";

  // Coleta todas as linhas atingidas pelos cursors.
  const linesSet = new Set<number>();
  for (const c of s.cursors) {
    const r = cursorRange(c);
    for (let l = r.start.line; l <= r.end.line; l++) linesSet.add(l);
  }
  const lines = Array.from(linesSet).sort((a, b) => a - b);
  // Decide: se TODAS já estão comentadas, descomenta; senão comenta.
  const allCommented = lines.every((l) => buf.getLine(l).trimStart().startsWith(prefix.trim()));

  const ops = lines.map((l) => {
    const text = buf.getLine(l);
    if (allCommented) {
      const idx = text.indexOf(prefix.trim());
      const after = text.slice(idx + prefix.trim().length);
      const cleaned = after.startsWith(" ") ? after.slice(1) : after;
      return {
        range: { start: { line: l, col: 0 }, end: { line: l, col: text.length } },
        text: text.slice(0, idx) + cleaned,
      };
    }
    // Insere prefixo no primeiro non-ws.
    let firstNonWs = 0;
    while (firstNonWs < text.length && /\s/.test(text[firstNonWs])) firstNonWs++;
    return {
      range: { start: { line: l, col: firstNonWs }, end: { line: l, col: firstNonWs } },
      text: prefix,
    };
  });
  s.edit(ops, s.cursors, "toggle-comment");
}
