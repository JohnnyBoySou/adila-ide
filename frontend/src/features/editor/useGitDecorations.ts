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

export function useGitDecorations({
  editor,
  monaco,
  path,
  rootUri,
  enabled,
}: UseGitDecorationsArgs) {
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!editor || !monaco || !enabled) {
      return;
    }

    let cancelled = false;

    const apply = async () => {
      try {
        const rel = toRelativePath(path, rootUri);
        const diff = await rpc.git.diff(rel, false);
        if (cancelled) return;
        const changes = parseUnifiedDiff(diff);
        const next: monacoTypes.editor.IModelDeltaDecoration[] = changes.map((c) => ({
          range: new monaco.Range(c.line, 1, c.line, 1),
          options: {
            isWholeLine: false,
            linesDecorationsClassName: `git-gutter git-gutter-${c.type}`,
          },
        }));
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, next);
      } catch {
        if (cancelled) return;
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
    };

    void apply();
    const off = rpc.on("git.changed", () => {
      void apply();
    });

    return () => {
      cancelled = true;
      off();
      if (editor) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
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

function parseUnifiedDiff(diff: string): Change[] {
  const changes: Change[] = [];
  if (!diff) return changes;
  const lines = diff.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith("@@")) {
      i++;
      continue;
    }
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (!match) {
      i++;
      continue;
    }
    let newLine = parseInt(match[1], 10);
    i++;

    let runDeletes = 0;
    let runAdds: number[] = [];
    const flush = () => {
      if (runAdds.length > 0) {
        const type: ChangeType = runDeletes > 0 ? "modified" : "added";
        for (const ln of runAdds) {
          changes.push({ type, line: ln });
        }
      } else if (runDeletes > 0) {
        changes.push({ type: "deleted", line: Math.max(1, newLine - 1) });
      }
      runDeletes = 0;
      runAdds = [];
    };

    while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff ")) {
      const c = lines[i][0];
      if (c === "+") {
        runAdds.push(newLine);
        newLine++;
      } else if (c === "-") {
        runDeletes++;
      } else if (c === " ") {
        flush();
        newLine++;
      }
      i++;
    }
    flush();
  }
  return changes;
}
