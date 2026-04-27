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
  const s_ = l - 0.0894841775 * a_ok - 1.291485548 * b_ok;

  const l3 = l_ * l_ * l_;
  const m3 = m_ * m_ * m_;
  const s3 = s_ * s_ * s_;

  const r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b_lin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const toSRGB = (v: number) => {
    const x = Math.max(0, Math.min(1, v));
    return Math.round(x <= 0.0031308 ? x * 12.92 * 255 : (1.055 * x ** (1 / 2.4) - 0.055) * 255);
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
    const p = rgbM[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(parseFloat);
    const [r = 0, g = 0, b = 0, a = 1] = p;
    const h = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0");
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

  const bg = readVar("--background");
  const fg = readVar("--foreground");
  const muted = readVar("--muted-foreground");
  const accent = readVar("--accent");
  const border = readVar("--border");
  const primary = readVar("--primary");
  const ring = readVar("--ring");
  const popover = readVar("--popover");
  const popoverFg = readVar("--popover-foreground");
  const destr = readVar("--destructive");

  // Paleta de sintaxe espelhando VSCode Dark+ / Light+ — calibradas pra ter
  // contraste consistente em qualquer fundo do tema do workbench. Os chart
  // colors do shadcn/ui são mid-luminance e baixa croma (desenhados pra
  // gráficos sobre cards), o que produzia azul/verde sem contraste no editor.
  // Mudar aqui afeta apenas o syntax highlight; cores de UI (background,
  // borda, sidebar etc.) continuam vindo das CSS vars do tema escolhido.
  const kw = dark ? "569CD6" : "0000FF"; // keyword     → azul VSCode
  const str = dark ? "CE9178" : "A31515"; // string      → laranja/peach
  const num = dark ? "B5CEA8" : "098658"; // number      → verde claro
  const typ = dark ? "4EC9B0" : "267F99"; // type        → teal
  const fn = dark ? "DCDCAA" : "795E26"; // function    → amarelo pastel
  const vr = dark ? "9CDCFE" : "001080"; // variable    → ciano claro
  const re = dark ? "D16969" : "811F3F"; // regexp      → salmão
  const cmt = dark ? "6A9955" : "008000"; // comment     → verde itálico

  return {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "", foreground: strip(fg), background: strip(bg) },
      { token: "comment", foreground: cmt, fontStyle: "italic" },
      { token: "comment.doc", foreground: cmt, fontStyle: "italic" },
      { token: "keyword", foreground: kw },
      { token: "keyword.control", foreground: kw },
      { token: "keyword.operator", foreground: kw },
      { token: "keyword.json", foreground: kw },
      { token: "string", foreground: str },
      { token: "string.escape", foreground: fn },
      { token: "string.invalid", foreground: strip(destr) },
      { token: "number", foreground: num },
      { token: "number.float", foreground: num },
      { token: "regexp", foreground: re },
      { token: "type", foreground: typ },
      { token: "type.identifier", foreground: typ },
      { token: "entity.name.type", foreground: typ },
      { token: "support.type", foreground: typ },
      { token: "function", foreground: fn },
      { token: "entity.name.function", foreground: fn },
      { token: "support.function", foreground: fn },
      { token: "variable", foreground: vr },
      { token: "variable.parameter", foreground: vr },
      { token: "variable.predefined", foreground: typ },
      { token: "identifier", foreground: vr },
      { token: "delimiter", foreground: strip(muted) },
      { token: "delimiter.bracket", foreground: strip(fg) },
      { token: "operator", foreground: strip(fg) },
      { token: "tag", foreground: kw },
      { token: "tag.id", foreground: typ },
      { token: "attribute.name", foreground: typ },
      { token: "attribute.value", foreground: str },
      { token: "metatag", foreground: kw },
      { token: "invalid", foreground: strip(destr) },
    ],
    colors: {
      "editor.background": bg,
      "editor.foreground": fg,
      "editorLineNumber.foreground": withAlpha(strip(muted), "80"),
      "editorLineNumber.activeForeground": strip(fg),
      "editor.lineHighlightBackground": withAlpha(strip(muted), "18"),
      "editor.lineHighlightBorder": "#00000000",
      // Seleção e cursor não usam --primary porque essa CSS var varia entre
      // temas (rose-pine tem primary rosa-avermelhado, ayu-mirage amarelo,
      // etc.) e produzia seleções com fundo saturado/agressivo no editor.
      // Aqui usamos a cor de keyword (azul calibrado) com baixa alpha
      // — replica o comportamento do VSCode Dark+ onde a seleção é sempre
      // azul-acinzentada independente do tema.
      "editor.selectionBackground": withAlpha(kw, "40"),
      "editor.inactiveSelectionBackground": withAlpha(kw, "20"),
      "editor.selectionHighlightBackground": withAlpha(kw, "20"),
      "editor.wordHighlightBackground": withAlpha(kw, "20"),
      "editor.findMatchBackground": withAlpha(kw, "60"),
      "editor.findMatchHighlightBackground": withAlpha(kw, "30"),
      // Cursor usa o foreground do tema → sempre tem contraste com o fundo.
      "editorCursor.foreground": strip(fg),
      "editorWhitespace.foreground": withAlpha(strip(muted), "50"),
      "editorIndentGuide.background1": withAlpha(strip(border), "80"),
      "editorIndentGuide.activeBackground1": strip(muted),
      "editorBracketMatch.background": withAlpha(strip(muted), "30"),
      "editorBracketMatch.border": strip(ring),
      "editorWidget.background": popover,
      "editorWidget.foreground": popoverFg,
      "editorWidget.border": strip(border),
      "editorSuggestWidget.background": popover,
      "editorSuggestWidget.foreground": popoverFg,
      "editorSuggestWidget.selectedBackground": withAlpha(strip(accent), "80"),
      "editorSuggestWidget.highlightForeground": strip(primary),
      "editorSuggestWidget.border": strip(border),
      "editorHoverWidget.background": popover,
      "editorHoverWidget.foreground": popoverFg,
      "editorHoverWidget.border": strip(border),
      "editorGroup.border": strip(border),
      "editorGutter.background": bg,
      "editorGutter.modifiedBackground": typ,
      "editorGutter.addedBackground": num, // verde da paleta de syntax
      "editorGutter.deletedBackground": strip(destr),
      "editorError.foreground": strip(destr),
      "editorWarning.foreground": fn, // amarelo da paleta de syntax
      "editorInfo.foreground": kw, // azul da paleta de syntax
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": withAlpha(strip(muted), "30"),
      "scrollbarSlider.hoverBackground": withAlpha(strip(muted), "60"),
      "scrollbarSlider.activeBackground": strip(muted),
      "minimap.background": bg,
      focusBorder: strip(ring),
    },
  };
}

// ── Instalação e auto-update ─────────────────────────────────────────────────

let observer: MutationObserver | null = null;
const installedFor = new WeakSet<Monaco>();
let lastThemeJSON = "";

export function installMonacoTailwindTheme(monaco: Monaco): void {
  const apply = () => {
    try {
      const next = buildTheme();
      // Só re-aplica se o tema realmente mudou. Evita repaint do highlight a
      // cada mutação irrelevante no <html> (ex: font-size do zoom, transições).
      const json = JSON.stringify(next);
      if (json === lastThemeJSON) return;
      lastThemeJSON = json;
      monaco.editor.defineTheme(THEME_NAME, next);
      monaco.editor.setTheme(THEME_NAME);
    } catch {
      // ignore
    }
  };

  apply();

  if (!installedFor.has(monaco)) {
    installedFor.add(monaco);
    if (observer) observer.disconnect();
    // Só observamos atributos que efetivamente trocam o tema (light/dark via
    // class ou data-theme). `style` muda por zoom/transição e causaria flicker
    // do syntax highlight a cada repaint.
    observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
  }
}

export const TAILWIND_MONACO_THEME = THEME_NAME;
