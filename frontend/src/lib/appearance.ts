import { call, on } from "@/rpc/core";

export type ThemeMode = "auto" | "light" | "dark";
export type RadiusScale = "sm" | "md" | "lg" | "xl";
export type Density = "compact" | "comfortable";
export type FontUiPreset = "google-sans-flex" | "system";
export type FontMonoPreset =
  | "google-sans-code"
  | "jetbrains-mono-nf"
  | "fira-code-nf"
  | "cascadia-code-nf"
  | "hack-nf"
  | "geist-mono-nf"
  | "meslo-lgs-nf"
  | "system";

export interface AppearanceOptions {
  theme: ThemeMode;
  accent: string;
  fontUi: FontUiPreset;
  fontMono: FontMonoPreset;
  radius: RadiusScale;
  density: Density;
}

export const APPEARANCE_KEYS = {
  theme: "adila.appearance.theme",
  accent: "adila.appearance.accent",
  fontUi: "adila.appearance.fontUi",
  fontMono: "adila.appearance.fontMono",
  radius: "adila.appearance.radius",
  density: "adila.appearance.density",
} as const;

export const APPEARANCE_DEFAULTS: AppearanceOptions = {
  theme: "dark",
  accent: "#f0a23c",
  fontUi: "google-sans-flex",
  fontMono: "google-sans-code",
  radius: "lg",
  density: "comfortable",
};

export const ACCENT_PRESETS: { value: string; label: string }[] = [
  { value: "#f0a23c", label: "Âmbar" },
  { value: "#ef4444", label: "Vermelho" },
  { value: "#ec4899", label: "Rosa" },
  { value: "#a855f7", label: "Roxo" },
  { value: "#3b82f6", label: "Azul" },
  { value: "#06b6d4", label: "Ciano" },
  { value: "#10b981", label: "Verde" },
  { value: "#84cc16", label: "Lima" },
];

const FONT_UI_STACKS: Record<FontUiPreset, string> = {
  "google-sans-flex":
    '"Google Sans Flex", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  system:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const FONT_MONO_STACKS: Record<FontMonoPreset, string> = {
  "google-sans-code":
    '"Google Sans Code", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
  "jetbrains-mono-nf":
    '"JetBrains Mono NF", ui-monospace, Menlo, Consolas, monospace',
  "fira-code-nf":
    '"Fira Code NF", ui-monospace, Menlo, Consolas, monospace',
  "cascadia-code-nf":
    '"Cascadia Code NF", ui-monospace, Menlo, Consolas, monospace',
  "hack-nf":
    '"Hack NF", ui-monospace, Menlo, Consolas, monospace',
  "geist-mono-nf":
    '"Geist Mono NF", ui-monospace, Menlo, Consolas, monospace',
  "meslo-lgs-nf":
    '"Meslo LGS NF", ui-monospace, Menlo, Consolas, monospace',
  system:
    'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
};

const RADIUS_BASE: Record<RadiusScale, number> = {
  sm: 0.375,
  md: 0.5,
  lg: 0.625,
  xl: 0.875,
};

interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
}

const DARK_PALETTE: ThemePalette = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  popoverForeground: "oklch(0.985 0 0)",
  primaryForeground: "oklch(0.145 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  destructiveForeground: "oklch(0.985 0 0)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
};

const LIGHT_PALETTE: ThemePalette = {
  background: "oklch(0.99 0 0)",
  foreground: "oklch(0.18 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.18 0 0)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.18 0 0)",
  primaryForeground: "oklch(0.99 0 0)",
  secondary: "oklch(0.96 0 0)",
  secondaryForeground: "oklch(0.18 0 0)",
  muted: "oklch(0.96 0 0)",
  mutedForeground: "oklch(0.45 0 0)",
  accent: "oklch(0.94 0 0)",
  accentForeground: "oklch(0.18 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  destructiveForeground: "oklch(0.985 0 0)",
  border: "oklch(0 0 0 / 10%)",
  input: "oklch(0 0 0 / 8%)",
};

function resolveMode(theme: ThemeMode): "light" | "dark" {
  if (theme === "auto") {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: light)").matches
    ) {
      return "light";
    }
    return "dark";
  }
  return theme;
}

function hexToOklch(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return "oklch(0.72 0.17 68)";
  }
  return rgbToOklchString(rgb);
}

function hexToRgb(hex: string): [number, number, number] | undefined {
  const m = /^#?([a-f\d]{3}|[a-f\d]{6})$/i.exec(hex.trim());
  if (!m) {
    return undefined;
  }
  let body = m[1];
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(body, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function rgbToOklchString([r, g, b]: [number, number, number]): string {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) {
    h += 360;
  }

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)})`;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function applyAppearance(opts: AppearanceOptions): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const mode = resolveMode(opts.theme);
  const palette = mode === "light" ? LIGHT_PALETTE : DARK_PALETTE;

  root.dataset.theme = mode;
  root.style.colorScheme = mode;

  const accentOklch = hexToOklch(opts.accent);
  root.style.setProperty("--color-primary", accentOklch);
  root.style.setProperty("--color-ring", accentOklch);
  root.style.setProperty("--color-primary-foreground", palette.primaryForeground);

  root.style.setProperty("--color-background", palette.background);
  root.style.setProperty("--color-foreground", palette.foreground);
  root.style.setProperty("--color-card", palette.card);
  root.style.setProperty("--color-card-foreground", palette.cardForeground);
  root.style.setProperty("--color-popover", palette.popover);
  root.style.setProperty(
    "--color-popover-foreground",
    palette.popoverForeground,
  );
  root.style.setProperty("--color-secondary", palette.secondary);
  root.style.setProperty(
    "--color-secondary-foreground",
    palette.secondaryForeground,
  );
  root.style.setProperty("--color-muted", palette.muted);
  root.style.setProperty(
    "--color-muted-foreground",
    palette.mutedForeground,
  );
  root.style.setProperty("--color-accent", palette.accent);
  root.style.setProperty(
    "--color-accent-foreground",
    palette.accentForeground,
  );
  root.style.setProperty("--color-destructive", palette.destructive);
  root.style.setProperty(
    "--color-destructive-foreground",
    palette.destructiveForeground,
  );
  root.style.setProperty("--color-border", palette.border);
  root.style.setProperty("--color-input", palette.input);

  root.style.setProperty("--font-sans", FONT_UI_STACKS[opts.fontUi]);
  root.style.setProperty("--font-mono", FONT_MONO_STACKS[opts.fontMono]);

  const base = RADIUS_BASE[opts.radius];
  root.style.setProperty("--radius-lg", `${base}rem`);
  root.style.setProperty("--radius-md", `calc(${base}rem - 2px)`);
  root.style.setProperty("--radius-sm", `calc(${base}rem - 4px)`);
  root.style.setProperty("--radius-xl", `calc(${base}rem + 4px)`);

  const fontPx = opts.density === "compact" ? 13 : 14;
  root.style.fontSize = `${fontPx}px`;
  root.dataset.density = opts.density;
}

export async function loadAppearance(): Promise<AppearanceOptions> {
  const entries = await Promise.all(
    (Object.keys(APPEARANCE_KEYS) as (keyof AppearanceOptions)[]).map(
      async (k) => {
        const value = await call<unknown>("config.get", {
          key: APPEARANCE_KEYS[k],
          defaultValue: APPEARANCE_DEFAULTS[k],
        });
        return [k, value ?? APPEARANCE_DEFAULTS[k]] as const;
      },
    ),
  );
  const opts = { ...APPEARANCE_DEFAULTS };
  for (const [k, v] of entries) {
    (opts as Record<string, unknown>)[k] = v;
  }
  return opts;
}

export async function bootstrapAppearance(): Promise<void> {
  try {
    const opts = await loadAppearance();
    applyAppearance(opts);
  } catch {
    applyAppearance(APPEARANCE_DEFAULTS);
  }
}

export function isAppearanceKey(key: string): boolean {
  return key.startsWith("adila.appearance.");
}

export function notifyAppearanceChanged(key: string): void {
  if (!isAppearanceKey(key)) {
    return;
  }
  void bootstrapAppearance();
}

let mediaListener: ((e: MediaQueryListEvent) => void) | undefined;

export function subscribeAppearance(
  getOptions: () => AppearanceOptions,
): () => void {
  const offConfig = on("config.changed", (payload) => {
    if (
      payload &&
      typeof payload === "object" &&
      "key" in (payload as Record<string, unknown>)
    ) {
      const key = (payload as { key: string }).key;
      if (key.startsWith("adila.appearance.")) {
        applyAppearance(getOptions());
      }
    }
  });

  let mql: MediaQueryList | undefined;
  if (typeof window !== "undefined" && window.matchMedia) {
    mql = window.matchMedia("(prefers-color-scheme: light)");
    mediaListener = () => {
      const opts = getOptions();
      if (opts.theme === "auto") {
        applyAppearance(opts);
      }
    };
    mql.addEventListener("change", mediaListener);
  }

  return () => {
    offConfig();
    if (mql && mediaListener) {
      mql.removeEventListener("change", mediaListener);
      mediaListener = undefined;
    }
  };
}
