import { create } from "zustand";

/**
 * Estado de UI de alta frequência ou desacoplado do App raiz.
 *
 * Por que store global:
 * - `cursorLine/cursorCol` muda a cada movimento de caret. Mantê-lo em
 *   `useState` no App fazia o componente raiz re-renderizar (e descender pra
 *   Sidebar, PaneTree, etc.) só pra StatusBar atualizar dois números.
 * - `branch` é setada por evento Git e lida só pela StatusBar.
 * - Flags de overlay (palette, quickOpen, ...) não precisam viver no App: são
 *   abertas/fechadas por shortcuts e cada uma só re-renderiza quem assina.
 *
 * Padrão de uso:
 * - Quem só lê: `useUiStore(s => s.cursorLine)` — selector para minimizar
 *   re-renders.
 * - Quem só escreve em handlers: `useUiStore.getState().setCursor(l, c)` —
 *   não inscreve, não re-renderiza o caller.
 */
interface UiState {
  cursorLine: number;
  cursorCol: number;
  branch: string;

  paletteOpen: boolean;
  paletteInitialQuery: string;
  quickOpenOpen: boolean;
  markdownPreviewOpen: boolean;
  themePickerOpen: boolean;

  setCursor: (line: number, col: number) => void;
  resetCursor: () => void;
  setBranch: (b: string) => void;

  openPalette: (initialQuery?: string) => void;
  closePalette: () => void;
  setPaletteOpen: (open: boolean) => void;

  setQuickOpenOpen: (v: boolean) => void;
  setMarkdownPreviewOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setThemePickerOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  cursorLine: 1,
  cursorCol: 1,
  branch: "",

  paletteOpen: false,
  paletteInitialQuery: "",
  quickOpenOpen: false,
  markdownPreviewOpen: false,
  themePickerOpen: false,

  setCursor: (cursorLine, cursorCol) => set({ cursorLine, cursorCol }),
  resetCursor: () => set({ cursorLine: 1, cursorCol: 1 }),
  setBranch: (branch) => set({ branch }),

  openPalette: (initialQuery = "") => set({ paletteOpen: true, paletteInitialQuery: initialQuery }),
  closePalette: () => set({ paletteOpen: false, paletteInitialQuery: "" }),
  setPaletteOpen: (paletteOpen) =>
    set(paletteOpen ? { paletteOpen } : { paletteOpen, paletteInitialQuery: "" }),

  setQuickOpenOpen: (quickOpenOpen) => set({ quickOpenOpen }),
  setMarkdownPreviewOpen: (v) =>
    set({ markdownPreviewOpen: typeof v === "function" ? v(get().markdownPreviewOpen) : v }),
  setThemePickerOpen: (themePickerOpen) => set({ themePickerOpen }),
}));
