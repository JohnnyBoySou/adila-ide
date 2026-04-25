import type * as monacoTypes from "monaco-editor";
import { rpc } from "@/features/file-tree/rpc";

const TRIGGER_LANGS = ["typescript", "javascript", "css", "scss", "html", "json"];

let registered = false;
const disposables: Array<{ dispose: () => void }> = [];

export function registerPathCompletion(monaco: typeof monacoTypes, currentFilePath: () => string) {
  if (registered) return;
  registered = true;

  for (const lang of TRIGGER_LANGS) {
    const d = monaco.languages.registerCompletionItemProvider(lang, {
      triggerCharacters: ["/", "."],
      async provideCompletionItems(model, position) {
        const lineText = model.getLineContent(position.lineNumber);
        const before = lineText.slice(0, position.column - 1);

        // Match string literal that's likely a path: import "...", require('...'), url("..."),
        // or any href/src= attribute. We capture the partial path between the opening quote and cursor.
        const match = /(?:["'`])([^"'`\n]*)$/.exec(before);
        if (!match) return { suggestions: [] };
        const partial = match[1];

        // Only act on relative paths.
        if (!partial.startsWith(".") && !partial.startsWith("/")) {
          return { suggestions: [] };
        }

        const filePath = currentFilePath();
        if (!filePath) return { suggestions: [] };

        const fileDir = filePath.replace(/[\\/][^\\/]*$/, "");
        const slashIdx = partial.lastIndexOf("/");
        const dirPart = slashIdx >= 0 ? partial.slice(0, slashIdx) : partial;
        const namePart = slashIdx >= 0 ? partial.slice(slashIdx + 1) : "";

        const targetDir = resolveRelative(fileDir, dirPart);
        let entries: Awaited<ReturnType<typeof rpc.fs.list>> = [];
        try {
          entries = await rpc.fs.list(targetDir);
        } catch {
          return { suggestions: [] };
        }

        const wordStart = position.column - namePart.length;
        const range = new monaco.Range(
          position.lineNumber,
          wordStart,
          position.lineNumber,
          position.column,
        );

        const suggestions: monacoTypes.languages.CompletionItem[] = entries
          .filter((e) => !e.name.startsWith("."))
          .map((e) => ({
            label: e.isDirectory ? `${e.name}/` : e.name,
            kind: e.isDirectory
              ? monaco.languages.CompletionItemKind.Folder
              : monaco.languages.CompletionItemKind.File,
            insertText: e.isDirectory ? `${e.name}/` : e.name,
            command: e.isDirectory
              ? { id: "editor.action.triggerSuggest", title: "" }
              : undefined,
            detail: e.isDirectory ? "directory" : "file",
            range,
          }));

        return { suggestions };
      },
    });
    disposables.push(d);
  }
}

export function unregisterPathCompletion() {
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;
  registered = false;
}

function resolveRelative(baseDir: string, rel: string): string {
  if (rel.startsWith("/")) return rel || "/";
  const sep = baseDir.includes("\\") ? "\\" : "/";
  const parts = baseDir.split(/[\\/]/).filter(Boolean);
  const isAbs = baseDir.startsWith("/") || /^[a-zA-Z]:/.test(baseDir);
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  if (isAbs && baseDir.startsWith("/")) return `/${parts.join(sep)}`;
  return parts.join(sep);
}
