import { useEffect, useRef } from "react";
import type * as monacoTypes from "monaco-editor";
import { rpc } from "@/features/git/rpc";

type ChangeType = "added" | "modified" | "deleted";
type Change = { type: ChangeType; line: number };

interface UseGitDecorationsArgs {
  editor: monacoTypes.editor.IStandaloneCodeEditor | null;
  monaco: typeof monacoTypes | null;
  path: string;
  rootUri?: string;
  enabled: boolean;
}

const DEBOUNCE_MS = 150;

export function useGitDecorations({
  editor,
  monaco,
  path,
  rootUri,
  enabled,
}: UseGitDecorationsArgs) {
  const decorationsRef = useRef<string[]>([]);
  const headRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editor || !monaco || !enabled) {
      return;
    }

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const recompute = () => {
      if (cancelled) return;
      const model = editor.getModel();
      if (!model) return;
      const head = headRef.current;
      if (head === null) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
        return;
      }
      const current = model.getValue();
      const changes = diffLines(head, current);
      const next: monacoTypes.editor.IModelDeltaDecoration[] = changes.map((c) => ({
        range: new monaco.Range(c.line, 1, c.line, 1),
        options: {
          isWholeLine: false,
          linesDecorationsClassName: `git-gutter git-gutter-${c.type}`,
        },
      }));
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, next);
    };

    const scheduleRecompute = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(recompute, DEBOUNCE_MS);
    };

    const loadHead = async () => {
      try {
        const rel = toRelativePath(path, rootUri);
        const head = await rpc.git.showAtHead(rel);
        if (cancelled) return;
        headRef.current = head ?? "";
      } catch {
        if (cancelled) return;
        headRef.current = "";
      }
      recompute();
    };

    void loadHead();

    const contentSub = editor.onDidChangeModelContent(() => {
      scheduleRecompute();
    });

    const off = rpc.on("git.changed", () => {
      void loadHead();
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      contentSub.dispose();
      off();
      if (editor) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
      headRef.current = null;
    };
  }, [editor, monaco, path, rootUri, enabled]);
}

function toRelativePath(absolute: string, rootUri?: string): string {
  if (!rootUri) return absolute;
  let root = rootUri;
  if (root.startsWith("file://")) {
    root = decodeURIComponent(root.slice(7));
  }
  if (absolute.startsWith(`${root}/`) || absolute.startsWith(`${root}\\`)) {
    return absolute.slice(root.length + 1);
  }
  return absolute;
}

// Simple LCS-based line diff. Produces decoration markers in the "new" file
// space: added, modified (replaced), deleted (gutter on the line after the gap).
function diffLines(oldText: string, newText: string): Change[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Trim trailing empty line that comes from a final newline in both, so we
  // don't mark a phantom change.
  if (oldLines.length > 0 && oldLines[oldLines.length - 1] === "") oldLines.pop();
  if (newLines.length > 0 && newLines[newLines.length - 1] === "") newLines.pop();

  const m = oldLines.length;
  const n = newLines.length;

  if (m === 0 && n === 0) return [];
  if (m === 0) {
    return newLines.map((_, i) => ({ type: "added" as const, line: i + 1 }));
  }
  if (n === 0) {
    return [{ type: "deleted" as const, line: 1 }];
  }

  // Build LCS table. For very large files we cap to avoid quadratic blowups.
  const MAX = 5000;
  if (m > MAX || n > MAX) {
    // Fallback: only mark whole file as modified to avoid huge allocations.
    if (oldText === newText) return [];
    return newLines.map((_, i) => ({ type: "modified" as const, line: i + 1 }));
  }

  const dp: Uint16Array[] = new Array(m + 1);
  for (let i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  // Walk to produce ops: equal/add/del.
  type Op = { kind: "eq" | "add" | "del"; oldIdx: number; newIdx: number };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ kind: "eq", oldIdx: i, newIdx: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ kind: "del", oldIdx: i, newIdx: j });
      i++;
    } else {
      ops.push({ kind: "add", oldIdx: i, newIdx: j });
      j++;
    }
  }
  while (i < m) ops.push({ kind: "del", oldIdx: i++, newIdx: j });
  while (j < n) ops.push({ kind: "add", oldIdx: i, newIdx: j++ });

  // Group consecutive non-eq ops into hunks; classify: adds + dels => modified,
  // adds only => added, dels only => deleted.
  const changes: Change[] = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === "eq") {
      k++;
      continue;
    }
    const startNewIdx = ops[k].newIdx;
    const adds: number[] = [];
    let dels = 0;
    while (k < ops.length && ops[k].kind !== "eq") {
      if (ops[k].kind === "add") {
        adds.push(ops[k].newIdx + 1);
      } else {
        dels++;
      }
      k++;
    }
    if (adds.length > 0) {
      const type: ChangeType = dels > 0 ? "modified" : "added";
      for (const ln of adds) changes.push({ type, line: ln });
    } else if (dels > 0) {
      // Pure deletion — mark gutter on the line at startNewIdx (or last if EOF).
      const ln = startNewIdx < n ? startNewIdx + 1 : Math.max(1, n);
      changes.push({ type: "deleted", line: ln });
    }
  }
  return changes;
}
