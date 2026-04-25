/**
 * Tema Monaco sincronizado com as CSS variables do Tailwind.
 *
 * Lê `--background`, `--foreground`, etc. diretamente do `getPropertyValue`
 * do `document.documentElement` (já considera `.dark` no cascade) e converte
 * oklch → sRGB internamente, sem depender de getComputedStyle para isso.
 */

import type * as MonacoNs from "monaco-editor";

type Monaco = typeof MonacoNs;

const THEME_NAME = "tailwind";

// ── Conversão de cor ─────────────────────────────────────────────────────────

function oklchToHex(l: number, c: number, h: number, alpha = 1): string {
  const hRad = (h * Math.PI) / 180;
  const a_ok = c * Math.cos(hRad);
  const b_ok = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a_ok + 0.2158037573 * b_ok;
  const m_ = l - 0.1055613458 * a_ok - 0.0638541728 * b_ok;
  const s_ = l - 0.0894841775 * a_ok - 1.2914855480 * b_ok;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const toSRGB = (v: number) => {
    const x = Math.max(0, Math.min(1, v));
    return Math.round(
      x <= 0.0031308 ? x * 12.92 * 255 : (1.055 * x ** (1 / 2.4) - 0.055) * 255,
    );
  };

  const h2 = (n: number) => n.toString(16).padStart(2, "0");
  const r = toSRGB(r_lin);
  const g = toSRGB(g_lin);
  const b = toSRGB(b_lin);
  if (alpha < 1) return `#${h2(r)}${h2(g)}${h2(b)}${h2(Math.round(alpha * 255))}`;
  return `#${h2(r)}${h2(g)}${h2(b)}`;
}

function parseColor(raw: string): string {
  const s = raw.trim();

  // rgb / rgba
  const rgbM = s.match(/rgba?\(\s*([^)]+)\)/);
  if (rgbM) {
    const p = rgbM[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    const [r = 0, g = 0, b = 0, a = 1] = p;
    const h = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    if (a < 1) return `#${h(r)}${h(g)}${h(b)}${h(Math.round(a * 255))}`;
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  // oklch( L C H [/ alpha] )
  const oklchM = s.match(/oklch\(\s*([^)]+)\)/);
  if (oklchM) {
    const [lchPart, alphaPart] = oklchM[1].split("/");
    const parts = (lchPart ?? "").trim().split(/\s+/);
    const l = parseFloat(parts[0] ?? "0");
    const c = parseFloat(parts[1] ?? "0");
    const h = parseFloat(parts[2] ?? "0");
    let alpha = 1;
    if (alphaPart) {
      const a = alphaPart.trim();
      alpha = a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
    }
    return oklchToHex(l, isNaN(c) ? 0 : c, isNaN(h) ? 0 : h, isNaN(alpha) ? 1 : alpha);
  }

  if (s.startsWith("#")) return s;
  return "#808080";
}

function readVar(name: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? parseColor(raw) : "#808080";
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function strip(hex: string): string {
  return hex.replace(/^#/, "").slice(0, 6).toUpperCase();
}

function withAlpha(hex: string, alphaHex: string): string {
  const base = hex.startsWith("#") ? hex.slice(0, 7) : `#${hex.slice(0, 6)}`;
  return `${base}${alphaHex}`;
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

// ── Construção do tema ────────────────────────────────────────────────────────

function buildTheme(): MonacoNs.editor.IStandaloneThemeData {
  const dark = isDark();

  const bg       = readVar("--background");
  const fg       = readVar("--foreground");
  const muted    = readVar("--muted-foreground");
  const accent   = readVar("--accent");
  const border   = readVar("--border");
  const primary  = readVar("--primary");
  const ring     = readVar("--ring");
  const popover  = readVar("--popover");
  const popoverFg = readVar("--popover-foreground");
  const destr    = readVar("--destructive");
  const c1       = readVar("--chart-1");
  const c2       = readVar("--chart-2");
  const c3       = readVar("--chart-3");
  const c4       = readVar("--chart-4");
  const c5       = readVar("--chart-5");

  // Em light mode os chart colors de alta luminosidade ficam invisíveis sobre
  // fundo branco. Usamos cores fixas com bom contraste no tema claro.
  const kw  = dark ? strip(c1) : "0000CC"; // keywords  → azul escuro
  const str = dark ? strip(c2) : "A31515"; // strings   → vermelho escuro
  const num = dark ? strip(c3) : "098658"; // numbers   → verde escuro
  const typ = dark ? strip(c4) : "267F99"; // types     → teal
  const fn  = dark ? strip(c5) : "795E26"; // functions → amarelo-escuro
  const cmt = strip(muted);                // comments  → muted em ambos

  return {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "",                    foreground: strip(fg),  background: strip(bg) },
      { token: "comment",             foreground: cmt,        fontStyle: "italic" },
      { token: "comment.doc",         foreground: cmt,        fontStyle: "italic" },
      { token: "keyword",             foreground: kw },
      { token: "keyword.control",     foreground: kw },
      { token: "keyword.operator",    foreground: kw },
      { token: "keyword.json",        foreground: kw },
      { token: "string",              foreground: str },
      { token: "string.escape",       foreground: fn },
      { token: "string.invalid",      foreground: strip(destr) },
      { token: "number",              foreground: num },
      { token: "number.float",        foreground: num },
      { token: "regexp",              foreground: fn },
      { token: "type",                foreground: typ },
      { token: "type.identifier",     foreground: typ },
      { token: "entity.name.type",    foreground: typ },
      { token: "support.type",        foreground: typ },
      { token: "function",            foreground: fn },
      { token: "entity.name.function",foreground: fn },
      { token: "support.function",    foreground: fn },
      { token: "variable",            foreground: strip(fg) },
      { token: "variable.predefined", foreground: typ },
      { token: "identifier",          foreground: strip(fg) },
      { token: "delimiter",           foreground: strip(muted) },
      { token: "delimiter.bracket",   foreground: strip(fg) },
      { token: "operator",            foreground: strip(fg) },
      { token: "tag",                 foreground: kw },
      { token: "tag.id",              foreground: typ },
      { token: "attribute.name",      foreground: typ },
      { token: "attribute.value",     foreground: str },
      { token: "metatag",             foreground: kw },
      { token: "invalid",             foreground: strip(destr) },
    ],
    colors: {
      "editor.background":                     bg,
      "editor.foreground":                     fg,
      "editorLineNumber.foreground":           withAlpha(strip(muted), "80"),
      "editorLineNumber.activeForeground":     strip(fg),
      "editor.lineHighlightBackground":        withAlpha(strip(muted), "18"),
      "editor.lineHighlightBorder":            "#00000000",
      "editor.selectionBackground":            withAlpha(strip(primary), "40"),
      "editor.inactiveSelectionBackground":    withAlpha(strip(primary), "20"),
      "editor.selectionHighlightBackground":   withAlpha(strip(primary), "20"),
      "editor.wordHighlightBackground":        withAlpha(strip(primary), "20"),
      "editor.findMatchBackground":            withAlpha(strip(primary), "60"),
      "editor.findMatchHighlightBackground":   withAlpha(strip(primary), "30"),
      "editorCursor.foreground":               strip(primary),
      "editorWhitespace.foreground":           withAlpha(strip(muted), "50"),
      "editorIndentGuide.background1":         withAlpha(strip(border), "80"),
      "editorIndentGuide.activeBackground1":   strip(muted),
      "editorBracketMatch.background":         withAlpha(strip(muted), "30"),
      "editorBracketMatch.border":             strip(ring),
      "editorWidget.background":               popover,
      "editorWidget.foreground":               popoverFg,
      "editorWidget.border":                   strip(border),
      "editorSuggestWidget.background":        popover,
      "editorSuggestWidget.foreground":        popoverFg,
      "editorSuggestWidget.selectedBackground": withAlpha(strip(accent), "80"),
      "editorSuggestWidget.highlightForeground": strip(primary),
      "editorSuggestWidget.border":            strip(border),
      "editorHoverWidget.background":          popover,
      "editorHoverWidget.foreground":          popoverFg,
      "editorHoverWidget.border":              strip(border),
      "editorGroup.border":                    strip(border),
      "editorGutter.background":               bg,
      "editorGutter.modifiedBackground":       typ,
      "editorGutter.addedBackground":          dark ? strip(c2) : "098658",
      "editorGutter.deletedBackground":        strip(destr),
      "editorError.foreground":                strip(destr),
      "editorWarning.foreground":              dark ? strip(c3) : "795E26",
      "editorInfo.foreground":                 dark ? strip(c1) : "0000CC",
      "scrollbar.shadow":                      "#00000000",
      "scrollbarSlider.background":            withAlpha(strip(muted), "30"),
      "scrollbarSlider.hoverBackground":       withAlpha(strip(muted), "60"),
      "scrollbarSlider.activeBackground":      strip(muted),
      "minimap.background":                    bg,
      focusBorder:                             strip(ring),
    },
  };
}

// ── Instalação e auto-update ─────────────────────────────────────────────────

let observer: MutationObserver | null = null;
const installedFor = new WeakSet<Monaco>();

export function installMonacoTailwindTheme(monaco: Monaco): void {
  const apply = () => {
    try {
      monaco.editor.defineTheme(THEME_NAME, buildTheme());
      monaco.editor.setTheme(THEME_NAME);
    } catch {
      // ignore
    }
  };

  apply();

  if (!installedFor.has(monaco)) {
    installedFor.add(monaco);
    if (observer) observer.disconnect();
    observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });
  }
}

export const TAILWIND_MONACO_THEME = THEME_NAME;
