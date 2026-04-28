import type * as proto from "vscode-languageserver-protocol";
import type { Position, Range } from "../buffer/types";
import type { EditOp } from "../state/editorStore";

export function lspPositionToPosition(pos: proto.Position): Position {
  return { line: pos.line, col: pos.character };
}

export function lspRangeToRange(range: proto.Range): Range {
  return {
    start: lspPositionToPosition(range.start),
    end: lspPositionToPosition(range.end),
  };
}

export function textEditToOp(edit: proto.TextEdit): EditOp {
  return { range: lspRangeToRange(edit.range), text: edit.newText };
}

function completionTextEditToOp(edit: proto.TextEdit | proto.InsertReplaceEdit): EditOp {
  const range = "range" in edit ? edit.range : edit.replace;
  return { range: lspRangeToRange(range), text: snippetToPlainText(edit.newText) };
}

export function completionInsertText(item: proto.CompletionItem): string {
  const raw = item.insertText ?? item.label;
  if (item.insertTextFormat === 2) return snippetToPlainText(raw);
  return raw;
}

export function snippetToPlainText(snippet: string): string {
  let out = snippet;
  out = out.replace(/\$\{(\d+):([^}]*)\}/g, "$2");
  out = out.replace(/\$\{(\d+)\|([^}]*)\|\}/g, (_m, _idx, choices: string) => {
    return choices.split(",")[0] ?? "";
  });
  out = out.replace(/\$\{[^}:]+:([^}]*)\}/g, "$1");
  out = out.replace(/\$\d+/g, "");
  out = out.replace(/\\([\\$}])/g, "$1");
  return out;
}

export function finalPositionAfterEdit(op: EditOp): Position {
  const lines = op.text.split("\n");
  if (lines.length === 1) {
    return { line: op.range.start.line, col: op.range.start.col + lines[0].length };
  }
  return {
    line: op.range.start.line + lines.length - 1,
    col: lines[lines.length - 1].length,
  };
}

export function editsFromCompletion(item: proto.CompletionItem, fallbackRange: Range): EditOp[] {
  const primary = item.textEdit
    ? completionTextEditToOp(item.textEdit)
    : { range: fallbackRange, text: completionInsertText(item) };
  const additional = item.additionalTextEdits?.map(textEditToOp) ?? [];
  return [...additional, primary];
}

export function editsFromWorkspaceEdit(
  edit: proto.WorkspaceEdit | undefined,
  currentUri: string | null | undefined,
): EditOp[] {
  const ops: EditOp[] = [];
  if (!edit || !currentUri) return ops;
  if (edit.changes?.[currentUri]) {
    ops.push(...edit.changes[currentUri].map(textEditToOp));
  }
  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      if (!("textDocument" in change) || change.textDocument.uri !== currentUri) continue;
      for (const edit of change.edits) {
        if ("range" in edit && "newText" in edit) ops.push(textEditToOp(edit));
      }
    }
  }
  return ops;
}
