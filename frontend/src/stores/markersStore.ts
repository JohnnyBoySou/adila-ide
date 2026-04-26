import { create } from "zustand";
import type { EditorMarker } from "@/features/editor/ProblemsPanel";

/**
 * LSP/diagnostics markers por arquivo.
 *
 * Por que store global: `setModelMarkers` do Monaco dispara várias vezes
 * por segundo durante digitação. Mantê-lo em `useState` no App rerenderizava
 * o root (e Sidebar/PaneTree/TopBar) a cada keystroke. Aqui só StatusBar
 * (counts) e ProblemsPanel (lista) assinam, e cada um pega só a fatia que precisa.
 */
interface MarkersState {
  items: Record<string, EditorMarker[]>;
  errorCount: number;
  warningCount: number;
  setForPath: (path: string, markers: EditorMarker[]) => void;
  clearPath: (path: string) => void;
}

function countSeverity(items: Record<string, EditorMarker[]>) {
  let errors = 0;
  let warnings = 0;
  for (const path in items) {
    for (const m of items[path]) {
      if (m.severity === 8) errors++;
      else if (m.severity === 4) warnings++;
    }
  }
  return { errors, warnings };
}

export const useMarkersStore = create<MarkersState>((set) => ({
  items: {},
  errorCount: 0,
  warningCount: 0,
  setForPath: (path, markers) =>
    set((s) => {
      const next = { ...s.items, [path]: markers };
      const { errors, warnings } = countSeverity(next);
      return { items: next, errorCount: errors, warningCount: warnings };
    }),
  clearPath: (path) =>
    set((s) => {
      if (!(path in s.items)) return s;
      const { [path]: _, ...rest } = s.items;
      const { errors, warnings } = countSeverity(rest);
      return { items: rest, errorCount: errors, warningCount: warnings };
    }),
}));
