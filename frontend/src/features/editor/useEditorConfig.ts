import { useConfig } from "@/hooks/useConfig";

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

export function useEditorConfig(): EditorConfig {
  const { value: theme } = useConfig("monaco.theme", "tailwind");
  const { value: fontSize } = useConfig("editor.fontSize", 13);
  const { value: fontFamily } = useConfig(
    "editor.fontFamily",
    "'Google Sans Mono', 'Fira Code', monospace",
  );
  const { value: tabSize } = useConfig("editor.tabSize", 2);
  const { value: wordWrap } = useConfig<WordWrap>("editor.wordWrap", "off");
  const { value: minimap } = useConfig("editor.minimap.enabled", false);
  const { value: cursorBlinking } = useConfig<CursorBlinking>("editor.cursorBlinking", "smooth");
  const { value: cursorSmoothCaret } = useConfig<CursorSmoothCaret>(
    "editor.cursorSmoothCaretAnimation",
    "on",
  );
  const { value: lineNumbers } = useConfig<LineNumbers>("editor.lineNumbers", "on");
  const { value: renderWhitespace } = useConfig<RenderWhitespace>(
    "editor.renderWhitespace",
    "selection",
  );
  const { value: scrollBeyondLastLine } = useConfig("editor.scrollBeyondLastLine", false);
  const { value: smoothScrolling } = useConfig("editor.smoothScrolling", true);
  const { value: renderLineHighlight } = useConfig<RenderLineHighlight>(
    "editor.renderLineHighlight",
    "all",
  );
  const { value: formatOnSave } = useConfig("editor.formatOnSave", false);
  const { value: formatOnPaste } = useConfig("editor.formatOnPaste", false);
  const { value: formatOnType } = useConfig("editor.formatOnType", false);
  const { value: autoSave } = useConfig("files.autoSave", "off");
  const { value: autoSaveDelay } = useConfig("files.autoSaveDelay", 1000);
  const { value: bracketPairColorization } = useConfig(
    "editor.bracketPairColorization.enabled",
    true,
  );
  const { value: bracketPairGuides } = useConfig<BracketPairGuides>(
    "editor.guides.bracketPairs",
    "active",
  );
  const { value: indentGuides } = useConfig("editor.guides.indentation", true);
  const { value: stickyScroll } = useConfig("editor.stickyScroll.enabled", true);
  const { value: fontLigatures } = useConfig("editor.fontLigatures", true);
  const { value: mouseWheelZoom } = useConfig("editor.mouseWheelZoom", false);
  const { value: linkedEditing } = useConfig("editor.linkedEditing", true);
  const { value: inlayHints } = useConfig<InlayHints>("editor.inlayHints.enabled", "on");
  const { value: codeLens } = useConfig("editor.codeLens", true);
  const { value: paddingTop } = useConfig("editor.padding.top", 12);
  const { value: gitGutter } = useConfig("editor.gitGutter", true);
  const { value: snippets } = useConfig("editor.snippets.enabled", true);
  const { value: pathCompletion } = useConfig("editor.pathCompletion.enabled", true);
  const { value: userSnippets } = useConfig("editor.userSnippets", "[]");

  return {
    theme: theme as string,
    fontSize: fontSize as number,
    fontFamily: fontFamily as string,
    tabSize: tabSize as number,
    wordWrap,
    minimap: minimap as boolean,
    cursorBlinking,
    cursorSmoothCaret,
    lineNumbers,
    renderWhitespace,
    scrollBeyondLastLine: scrollBeyondLastLine as boolean,
    smoothScrolling: smoothScrolling as boolean,
    renderLineHighlight,
    formatOnSave: formatOnSave as boolean,
    formatOnPaste: formatOnPaste as boolean,
    formatOnType: formatOnType as boolean,
    autoSave: autoSave as string,
    autoSaveDelay: autoSaveDelay as number,
    bracketPairColorization: bracketPairColorization as boolean,
    bracketPairGuides,
    indentGuides: indentGuides as boolean,
    stickyScroll: stickyScroll as boolean,
    fontLigatures: fontLigatures as boolean,
    mouseWheelZoom: mouseWheelZoom as boolean,
    linkedEditing: linkedEditing as boolean,
    inlayHints,
    codeLens: codeLens as boolean,
    paddingTop: paddingTop as number,
    gitGutter: gitGutter as boolean,
    snippets: snippets as boolean,
    pathCompletion: pathCompletion as boolean,
    userSnippets: userSnippets as string,
  };
}
