import { call, on } from "@/rpc/core";

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
  fontUi: FontUiPreset;
  fontMono: FontMonoPreset;
  radius: RadiusScale;
  density: Density;
  transparency: boolean;
  transparencyOpacity: number;
  transparencyBlur: number;
}

export const APPEARANCE_KEYS = {
  fontUi: "adila.appearance.fontUi",
  fontMono: "adila.appearance.fontMono",
  radius: "adila.appearance.radius",
  density: "adila.appearance.density",
  transparency: "adila.appearance.transparency",
  transparencyOpacity: "adila.appearance.transparencyOpacity",
  transparencyBlur: "adila.appearance.transparencyBlur",
} as const;

export const APPEARANCE_DEFAULTS: AppearanceOptions = {
  fontUi: "google-sans-flex",
  fontMono: "google-sans-code",
  radius: "lg",
  density: "comfortable",
  transparency: false,
  transparencyOpacity: 0.85,
  transparencyBlur: 24,
};

const FONT_UI_STACKS: Record<FontUiPreset, string> = {
  "google-sans-flex":
    '"Google Sans Flex", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  system:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const FONT_MONO_STACKS: Record<FontMonoPreset, string> = {
  "google-sans-code":
    '"Google Sans Code", ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
  "jetbrains-mono-nf": '"JetBrains Mono NF", ui-monospace, Menlo, Consolas, monospace',
  "fira-code-nf": '"Fira Code NF", ui-monospace, Menlo, Consolas, monospace',
  "cascadia-code-nf": '"Cascadia Code NF", ui-monospace, Menlo, Consolas, monospace',
  "hack-nf": '"Hack NF", ui-monospace, Menlo, Consolas, monospace',
  "geist-mono-nf": '"Geist Mono NF", ui-monospace, Menlo, Consolas, monospace',
  "meslo-lgs-nf": '"Meslo LGS NF", ui-monospace, Menlo, Consolas, monospace',
  system:
    'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace',
};

const RADIUS_BASE: Record<RadiusScale, number> = {
  sm: 0.375,
  md: 0.5,
  lg: 0.625,
  xl: 0.875,
};

export function applyAppearance(opts: AppearanceOptions): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;

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

  const opacity = Math.min(1, Math.max(0.2, Number(opts.transparencyOpacity) || 0.85));
  const blur = Math.min(80, Math.max(0, Number(opts.transparencyBlur) || 0));
  root.style.setProperty("--app-bg-alpha", String(opacity));
  root.style.setProperty("--app-blur", `${blur}px`);
  root.classList.toggle("translucent", !!opts.transparency);
}

export async function loadAppearance(): Promise<AppearanceOptions> {
  const entries = await Promise.all(
    (Object.keys(APPEARANCE_KEYS) as (keyof AppearanceOptions)[]).map(async (k) => {
      const value = await call<unknown>("config.get", {
        key: APPEARANCE_KEYS[k],
        defaultValue: APPEARANCE_DEFAULTS[k],
      });
      return [k, value ?? APPEARANCE_DEFAULTS[k]] as const;
    }),
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

export function subscribeAppearance(getOptions: () => AppearanceOptions): () => void {
  const offConfig = on("config.changed", (payload) => {
    if (payload && typeof payload === "object" && "key" in (payload as Record<string, unknown>)) {
      const key = (payload as { key: string }).key;
      if (key.startsWith("adila.appearance.")) {
        applyAppearance(getOptions());
      }
    }
  });
  // getOptions é mantido na assinatura para compatibilidade com chamadas existentes.
  void getOptions;
  return offConfig;
}
