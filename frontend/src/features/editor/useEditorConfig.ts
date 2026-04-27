import { useCallback, useMemo } from "react";
import { useConfigs } from "@/hooks/useConfigs";

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 40;
export const FONT_SIZE_DEFAULT = 13;

function clampFontSize(n: number): number {
  if (!Number.isFinite(n)) return FONT_SIZE_DEFAULT;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(n)));
}

type WordWrap = "off" | "on" | "wordWrapColumn" | "bounded";
type CursorBlinking = "blink" | "smooth" | "phase" | "expand" | "solid";
type CursorSmoothCaret = "off" | "explicit" | "on";
type RenderWhitespace = "none" | "boundary" | "selection" | "trailing" | "all";
type RenderLineHighlight = "none" | "gutter" | "line" | "all";
type LineNumbers = "on" | "off" | "relative";
type BracketPairGuides = "off" | "active" | "always";
type InlayHints = "on" | "off" | "onUnlessPressed" | "offUnlessPressed";

export type EditorConfig = {
  theme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: WordWrap;
  minimap: boolean;
  cursorBlinking: CursorBlinking;
  cursorSmoothCaret: CursorSmoothCaret;
  lineNumbers: LineNumbers;
  renderWhitespace: RenderWhitespace;
  scrollBeyondLastLine: boolean;
  smoothScrolling: boolean;
  renderLineHighlight: RenderLineHighlight;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;
  autoSave: string;
  autoSaveDelay: number;
  bracketPairColorization: boolean;
  bracketPairGuides: BracketPairGuides;
  indentGuides: boolean;
  stickyScroll: boolean;
  fontLigatures: boolean;
  mouseWheelZoom: boolean;
  linkedEditing: boolean;
  inlayHints: InlayHints;
  codeLens: boolean;
  paddingTop: number;
  gitGutter: boolean;
  snippets: boolean;
  pathCompletion: boolean;
  userSnippets: string;
};

export interface EditorConfigWithControls {
  config: EditorConfig;
  setFontSize: (n: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

export function useEditorConfig(): EditorConfigWithControls {
  const { values, set } = useConfigs({
    "monaco.theme": "tailwind",
    "editor.fontSize": FONT_SIZE_DEFAULT,
    "editor.fontFamily": "'Google Sans Mono', 'Fira Code', monospace",
    "editor.tabSize": 2,
    "editor.wordWrap": "off" as WordWrap,
    "editor.minimap.enabled": false,
    "editor.cursorBlinking": "smooth" as CursorBlinking,
    "editor.cursorSmoothCaretAnimation": "on" as CursorSmoothCaret,
    "editor.lineNumbers": "on" as LineNumbers,
    "editor.renderWhitespace": "selection" as RenderWhitespace,
    "editor.scrollBeyondLastLine": false,
    "editor.smoothScrolling": true,
    "editor.renderLineHighlight": "all" as RenderLineHighlight,
    "editor.formatOnSave": false,
    "editor.formatOnPaste": false,
    "editor.formatOnType": false,
    "files.autoSave": "off",
    "files.autoSaveDelay": 1000,
    "editor.bracketPairColorization.enabled": true,
    "editor.guides.bracketPairs": "active" as BracketPairGuides,
    "editor.guides.indentation": true,
    "editor.stickyScroll.enabled": true,
    "editor.fontLigatures": true,
    "editor.mouseWheelZoom": false,
    "editor.linkedEditing": true,
    "editor.inlayHints.enabled": "on" as InlayHints,
    "editor.codeLens": true,
    "editor.padding.top": 12,
    "editor.gitGutter": true,
    "editor.snippets.enabled": true,
    "editor.pathCompletion.enabled": true,
    "editor.userSnippets": "[]",
  });

  const config = useMemo<EditorConfig>(
    () => ({
      theme: values["monaco.theme"],
      fontSize: values["editor.fontSize"],
      fontFamily: values["editor.fontFamily"],
      tabSize: values["editor.tabSize"],
      wordWrap: values["editor.wordWrap"],
      minimap: values["editor.minimap.enabled"],
      cursorBlinking: values["editor.cursorBlinking"],
      cursorSmoothCaret: values["editor.cursorSmoothCaretAnimation"],
      lineNumbers: values["editor.lineNumbers"],
      renderWhitespace: values["editor.renderWhitespace"],
      scrollBeyondLastLine: values["editor.scrollBeyondLastLine"],
      smoothScrolling: values["editor.smoothScrolling"],
      renderLineHighlight: values["editor.renderLineHighlight"],
      formatOnSave: values["editor.formatOnSave"],
      formatOnPaste: values["editor.formatOnPaste"],
      formatOnType: values["editor.formatOnType"],
      autoSave: values["files.autoSave"],
      autoSaveDelay: values["files.autoSaveDelay"],
      bracketPairColorization: values["editor.bracketPairColorization.enabled"],
      bracketPairGuides: values["editor.guides.bracketPairs"],
      indentGuides: values["editor.guides.indentation"],
      stickyScroll: values["editor.stickyScroll.enabled"],
      fontLigatures: values["editor.fontLigatures"],
      mouseWheelZoom: values["editor.mouseWheelZoom"],
      linkedEditing: values["editor.linkedEditing"],
      inlayHints: values["editor.inlayHints.enabled"],
      codeLens: values["editor.codeLens"],
      paddingTop: values["editor.padding.top"],
      gitGutter: values["editor.gitGutter"],
      snippets: values["editor.snippets.enabled"],
      pathCompletion: values["editor.pathCompletion.enabled"],
      userSnippets: values["editor.userSnippets"],
    }),
    [values],
  );

  const setFontSize = useCallback(
    (n: number) => {
      void set("editor.fontSize", clampFontSize(n));
    },
    [set],
  );

  const zoomIn = useCallback(() => {
    setFontSize(config.fontSize + 1);
  }, [config.fontSize, setFontSize]);

  const zoomOut = useCallback(() => {
    setFontSize(config.fontSize - 1);
  }, [config.fontSize, setFontSize]);

  const resetZoom = useCallback(() => {
    setFontSize(FONT_SIZE_DEFAULT);
  }, [setFontSize]);

  return { config, setFontSize, zoomIn, zoomOut, resetZoom };
}
