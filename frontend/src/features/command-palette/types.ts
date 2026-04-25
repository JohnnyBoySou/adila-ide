export type Mode = "commands" | "files" | "symbols" | "gotoLine" | "help";

export interface PaletteItem {
  id: string;
  title: string;
  description?: string;
  detail?: string;
  /** Right-aligned hint (e.g. keybinding, kind). */
  hint?: string;
  /** Codicon name without the `codicon-` prefix, e.g. `"file"`, `"symbol-class"`. */
  icon?: string;
}

export interface OpenEvent {
  initialPrefix: string;
}
