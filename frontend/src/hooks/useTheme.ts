import { useEffect } from "react";
import { useConfig } from "./useConfig";
import { DEFAULT_THEME_ID, THEMES, resolveTheme } from "@/lib/themes";

export const AVAILABLE_THEMES = THEMES.map((t) => t.id);

export const THEME_TO_MONACO: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.monaco]),
);

const ALL_THEME_CLASSES = Array.from(
  new Set(THEMES.map((t) => t.cssClass).filter((c): c is string => !!c)),
);

function applyTheme(colorTheme: string) {
  const theme = resolveTheme(colorTheme);
  const el = document.documentElement;
  el.classList.remove("dark", "light", ...ALL_THEME_CLASSES);
  el.classList.add(theme.mode);
  if (theme.cssClass) el.classList.add(theme.cssClass);
}

export function useTheme() {
  const { value: colorTheme, set: setColorTheme } = useConfig<string>(
    "workbench.colorTheme",
    DEFAULT_THEME_ID,
  );

  useEffect(() => {
    if (colorTheme) applyTheme(colorTheme);
  }, [colorTheme]);

  return {
    colorTheme: colorTheme ?? DEFAULT_THEME_ID,
    setColorTheme,
  };
}
