import Editor, { type OnMount, useMonaco } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { useEditorConfig } from "./useEditorConfig";
import { useLSP } from "./useLSP";
import type { EditorMarker } from "./ProblemsPanel";
import { TAILWIND_MONACO_THEME, installMonacoTailwindTheme } from "@/lib/monacoTailwindTheme";
import { EditorContextMenu } from "./EditorContextMenu";

const LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  xml: "xml",
  md: "markdown",
  mdx: "markdown",
  go: "go",
  py: "python",
  rs: "rust",
  sh: "shell",
  bash: "shell",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANG_MAP[ext] ?? "plaintext";
}

type Props = {
  path: string;
  content: string;
  rootUri?: string;
  onChange: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onMarkersChange?: (path: string, markers: EditorMarker[]) => void;
};

export function CodeEditor({
  path,
  content,
  rootUri,
  onChange,
  onCursorChange,
  onMarkersChange,
}: Props) {
  const cfg = useEditorConfig();
  const lang = detectLanguage(path);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoInstance = useMonaco();

  useLSP({
    lang,
    rootUri: rootUri ?? "",
    enabled: !!rootUri && lang !== "plaintext" && lang !== "markdown",
  });

  useEffect(() => {
    return EventsOn("editor.gotoLine", (payload: unknown) => {
      const ed = editorRef.current;
      if (!ed) return;
      const p = payload as { line?: number; column?: number } | null;
      const line = p?.line ?? 1;
      const column = p?.column ?? 1;
      ed.revealLineInCenter(line);
      ed.setPosition({ lineNumber: line, column });
      ed.focus();
    });
  }, []);

  // Ctrl+Shift+O: abre o picker de símbolos nativo do Monaco
  useEffect(() => {
    return EventsOn("editor.gotoSymbol", () => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.focus();
      ed.trigger("keyboard", "editor.action.quickOutline", null);
    });
  }, []);

  // Instala o tema Monaco sincronizado com as CSS vars do Tailwind.
  useEffect(() => {
    if (!monacoInstance || cfg.theme !== "tailwind") return;
    installMonacoTailwindTheme(monacoInstance);
  }, [monacoInstance, cfg.theme]);

  // Subscreve mudanças de markers (diagnósticos LSP/TypeScript) para este arquivo.
  useEffect(() => {
    if (!monacoInstance || !onMarkersChange) return;
    const disposable = monacoInstance.editor.onDidChangeMarkers((uris) => {
      const model = editorRef.current?.getModel();
      if (!model) return;
      if (uris.some((u) => u.toString() === model.uri.toString())) {
        const raw = monacoInstance.editor.getModelMarkers({ resource: model.uri });
        onMarkersChange(path, raw as unknown as EditorMarker[]);
      }
    });
    return () => disposable.dispose();
  }, [monacoInstance, path, onMarkersChange]);

  return (
    <EditorContextMenu getEditor={() => editorRef.current} filePath={path}>
      <Editor
        height="100%"
        language={lang}
        value={content}
        theme={cfg.theme === "tailwind" ? TAILWIND_MONACO_THEME : cfg.theme}
        path={path}
        onMount={(ed) => {
          editorRef.current = ed;
          ed.onDidChangeCursorPosition((e) => {
            onCursorChange?.(e.position.lineNumber, e.position.column);
          });
        }}
        onChange={(v) => onChange(v ?? "")}
        options={{
          contextmenu: false,
          fontSize: cfg.fontSize,
          fontFamily: cfg.fontFamily,
          fontLigatures: cfg.fontLigatures,
          minimap: { enabled: cfg.minimap },
          scrollBeyondLastLine: cfg.scrollBeyondLastLine,
          wordWrap: cfg.wordWrap,
          tabSize: cfg.tabSize,
          renderWhitespace: cfg.renderWhitespace,
          smoothScrolling: cfg.smoothScrolling,
          cursorBlinking: cfg.cursorBlinking,
          cursorSmoothCaretAnimation: cfg.cursorSmoothCaret,
          renderLineHighlight: cfg.renderLineHighlight,
          lineNumbers: cfg.lineNumbers,
          bracketPairColorization: { enabled: cfg.bracketPairColorization },
          guides: {
            bracketPairs:
              cfg.bracketPairGuides === "off"
                ? false
                : cfg.bracketPairGuides === "always"
                  ? true
                  : "active",
            indentation: cfg.indentGuides,
          },
          stickyScroll: { enabled: cfg.stickyScroll },
          mouseWheelZoom: cfg.mouseWheelZoom,
          linkedEditing: cfg.linkedEditing,
          formatOnPaste: cfg.formatOnPaste,
          formatOnType: cfg.formatOnType,
          inlayHints: { enabled: cfg.inlayHints },
          codeLens: cfg.codeLens,
          padding: { top: cfg.paddingTop },
        }}
      />
    </EditorContextMenu>
  );
}
