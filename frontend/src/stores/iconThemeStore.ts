import { create } from "zustand";
import { Get as cfgGet } from "../../wailsjs/go/main/Config";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import type { IconThemeId } from "@/lib/iconThemes";

const KEY = "workbench.iconTheme";
const DEFAULT: IconThemeId = "symbols";

function coerce(v: unknown): IconThemeId {
  return v === "minimal" || v === "symbols" ? v : DEFAULT;
}

interface IconThemeState {
  themeId: IconThemeId;
  setThemeId: (id: IconThemeId) => void;
}

export const useIconThemeStore = create<IconThemeState>((set) => ({
  themeId: DEFAULT,
  setThemeId: (id) => set({ themeId: id }),
}));

let bootstrapped = false;

/**
 * Hidrata o store na primeira chamada e ouve `config.changed` pra atualizar
 * quando o usuário trocar o tema nas Settings. Idempotente — chamar várias
 * vezes não cria múltiplos listeners.
 */
export function bootstrapIconTheme(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  void cfgGet(KEY, DEFAULT).then((v) => {
    useIconThemeStore.getState().setThemeId(coerce(v));
  });

  EventsOn("config.changed", (payload: { key: string; value: unknown }) => {
    if (payload?.key !== KEY) return;
    useIconThemeStore.getState().setThemeId(coerce(payload.value));
  });
}
