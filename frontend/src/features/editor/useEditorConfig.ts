import { useConfig } from "@/hooks/useConfig";

type WordWrap = "off" | "on" | "wordWrapColumn" | "bounded";
type CursorBlinking = "blink" | "smooth" | "phase" | "expand" | "solid";
type RenderWhitespace = "none" | "boundary" | "selection" | "trailing" | "all";
type RenderLineHighlight = "none" | "gutter" | "line" | "all";
type LineNumbers = "on" | "off" | "relative";

export type EditorConfig = {
  theme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: WordWrap;
  minimap: boolean;
  cursorBlinking: CursorBlinking;
  lineNumbers: LineNumbers;
  renderWhitespace: RenderWhitespace;
  scrollBeyondLastLine: boolean;
  smoothScrolling: boolean;
  renderLineHighlight: RenderLineHighlight;
  formatOnSave: boolean;
  autoSave: string;
  autoSaveDelay: number;
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
  const { value: cursorBlinking } = useConfig<CursorBlinking>(
    "editor.cursorBlinking",
    "smooth",
  );
  const { value: lineNumbers } = useConfig<LineNumbers>(
    "editor.lineNumbers",
    "on",
  );
  const { value: renderWhitespace } = useConfig<RenderWhitespace>(
    "editor.renderWhitespace",
    "selection",
  );
  const { value: scrollBeyondLastLine } = useConfig(
    "editor.scrollBeyondLastLine",
    false,
  );
  const { value: smoothScrolling } = useConfig("editor.smoothScrolling", true);
  const { value: renderLineHighlight } = useConfig<RenderLineHighlight>(
    "editor.renderLineHighlight",
    "all",
  );
  const { value: formatOnSave } = useConfig("editor.formatOnSave", false);
  const { value: autoSave } = useConfig("files.autoSave", "off");
  const { value: autoSaveDelay } = useConfig("files.autoSaveDelay", 1000);

  return {
    theme: theme as string,
    fontSize: fontSize as number,
    fontFamily: fontFamily as string,
    tabSize: tabSize as number,
    wordWrap,
    minimap: minimap as boolean,
    cursorBlinking,
    lineNumbers,
    renderWhitespace,
    scrollBeyondLastLine: scrollBeyondLastLine as boolean,
    smoothScrolling: smoothScrolling as boolean,
    renderLineHighlight,
    formatOnSave: formatOnSave as boolean,
    autoSave: autoSave as string,
    autoSaveDelay: autoSaveDelay as number,
  };
}
