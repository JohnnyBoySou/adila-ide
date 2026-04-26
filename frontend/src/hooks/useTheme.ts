import { useCallback, useEffect } from "react";
import { useConfigs } from "./useConfigs";
import {
  CUSTOM_THEME_ID,
  CUSTOM_THEME_VAR_KEYS,
  DEFAULT_THEME_ID,
  THEMES,
  resolveTheme,
} from "@/lib/themes";

export const AVAILABLE_THEMES = THEMES.map((t) => t.id);

export const THEME_TO_MONACO: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.monaco]),
);

const ALL_THEME_CLASSES = Array.from(
  new Set(THEMES.map((t) => t.cssClass).filter((c): c is string => !!c)),
);

export type CustomThemeConfig = {
  mode?: "dark" | "light";
  vars?: Record<string, string>;
};

function applyTheme(colorTheme: string, custom?: CustomThemeConfig | null) {
  const el = document.documentElement;
  // Sempre limpa overrides custom anteriores antes de aplicar
  for (const k of CUSTOM_THEME_VAR_KEYS) el.style.removeProperty(`--${k}`);

  if (colorTheme === CUSTOM_THEME_ID) {
    const mode = custom?.mode === "light" ? "light" : "dark";
    el.classList.remove("dark", "light", ...ALL_THEME_CLASSES);
    el.classList.add(mode);
    el.classList.add("theme-custom");
    const vars = custom?.vars ?? {};
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v === "string" && v.trim() !== "") {
        el.style.setProperty(`--${k}`, v);
      }
    }
    return;
  }

  const theme = resolveTheme(colorTheme);
  el.classList.remove("dark", "light", ...ALL_THEME_CLASSES);
  el.classList.add(theme.mode);
  if (theme.cssClass) el.classList.add(theme.cssClass);
}

export function useTheme() {
  // Bulk: 1 round-trip IPC para as 2 chaves (em vez de 2 useConfig paralelos).
  const { values, set } = useConfigs({
    "workbench.colorTheme": DEFAULT_THEME_ID,
    "workbench.customTheme": { mode: "dark", vars: {} } as CustomThemeConfig,
  });
  const colorTheme = values["workbench.colorTheme"];
  const customTheme = values["workbench.customTheme"];

  const setColorTheme = useCallback((v: string) => set("workbench.colorTheme", v), [set]);
  const setCustomTheme = useCallback(
    (v: CustomThemeConfig) => set("workbench.customTheme", v),
    [set],
  );

  useEffect(() => {
    if (colorTheme) applyTheme(colorTheme, customTheme);
  }, [colorTheme, customTheme]);

  return {
    colorTheme: colorTheme ?? DEFAULT_THEME_ID,
    setColorTheme,
    customTheme: customTheme ?? { mode: "dark", vars: {} },
    setCustomTheme,
  };
}
