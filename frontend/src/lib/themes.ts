export type ThemeMode = "dark" | "light";

export type ThemePreview = {
  bg: string;
  text: string;
  border: string;
  accent: string;
};

export type Theme = {
  id: string;
  label: string;
  mode: ThemeMode;
  cssClass?: string;
  monaco: string;
  preview: ThemePreview;
};

export const THEMES: Theme[] = [
  {
    id: "Default Dark Modern",
    label: "Escuro (padrão)",
    mode: "dark",
    monaco: "vs-dark",
    preview: { bg: "#1e1e2e", text: "#cdd6f4", border: "#313244", accent: "#89b4fa" },
  },
  {
    id: "Default Light Modern",
    label: "Claro (padrão)",
    mode: "light",
    monaco: "vs",
    preview: { bg: "#ffffff", text: "#333333", border: "#dddddd", accent: "#0066cc" },
  },
  {
    id: "High Contrast Dark",
    label: "Alto contraste escuro",
    mode: "dark",
    cssClass: "theme-hc-dark",
    monaco: "hc-black",
    preview: { bg: "#000000", text: "#ffffff", border: "#6fc3df", accent: "#ffff00" },
  },
  {
    id: "High Contrast Light",
    label: "Alto contraste claro",
    mode: "light",
    cssClass: "theme-hc-light",
    monaco: "hc-light",
    preview: { bg: "#ffffff", text: "#000000", border: "#0f4a85", accent: "#0f4a85" },
  },
  {
    id: "Dimmed Dark",
    label: "Escuro atenuado",
    mode: "dark",
    cssClass: "theme-dimmed",
    monaco: "vs-dark",
    preview: { bg: "#22272e", text: "#adbac7", border: "#373e47", accent: "#539bf5" },
  },
  {
    id: "GitHub Dark",
    label: "GitHub Dark",
    mode: "dark",
    cssClass: "theme-github-dark",
    monaco: "vs-dark",
    preview: { bg: "#0d1117", text: "#c9d1d9", border: "#30363d", accent: "#58a6ff" },
  },
  {
    id: "GitHub Light",
    label: "GitHub Light",
    mode: "light",
    cssClass: "theme-github-light",
    monaco: "vs",
    preview: { bg: "#ffffff", text: "#24292f", border: "#d0d7de", accent: "#0969da" },
  },
  {
    id: "Dracula",
    label: "Dracula",
    mode: "dark",
    cssClass: "theme-dracula",
    monaco: "vs-dark",
    preview: { bg: "#282a36", text: "#f8f8f2", border: "#44475a", accent: "#bd93f9" },
  },
  {
    id: "One Dark Pro",
    label: "One Dark Pro",
    mode: "dark",
    cssClass: "theme-one-dark",
    monaco: "vs-dark",
    preview: { bg: "#282c34", text: "#abb2bf", border: "#3e4451", accent: "#61afef" },
  },
  {
    id: "Nord",
    label: "Nord",
    mode: "dark",
    cssClass: "theme-nord",
    monaco: "vs-dark",
    preview: { bg: "#2e3440", text: "#d8dee9", border: "#434c5e", accent: "#88c0d0" },
  },
  {
    id: "Tokyo Night",
    label: "Tokyo Night",
    mode: "dark",
    cssClass: "theme-tokyo-night",
    monaco: "vs-dark",
    preview: { bg: "#1a1b26", text: "#c0caf5", border: "#2f3349", accent: "#7aa2f7" },
  },
  {
    id: "Catppuccin Mocha",
    label: "Catppuccin Mocha",
    mode: "dark",
    cssClass: "theme-catppuccin-mocha",
    monaco: "vs-dark",
    preview: { bg: "#1e1e2e", text: "#cdd6f4", border: "#313244", accent: "#cba6f7" },
  },
  {
    id: "Catppuccin Latte",
    label: "Catppuccin Latte",
    mode: "light",
    cssClass: "theme-catppuccin-latte",
    monaco: "vs",
    preview: { bg: "#eff1f5", text: "#4c4f69", border: "#ccd0da", accent: "#8839ef" },
  },
  {
    id: "Solarized Dark",
    label: "Solarized Dark",
    mode: "dark",
    cssClass: "theme-solarized-dark",
    monaco: "vs-dark",
    preview: { bg: "#002b36", text: "#839496", border: "#073642", accent: "#268bd2" },
  },
  {
    id: "Solarized Light",
    label: "Solarized Light",
    mode: "light",
    cssClass: "theme-solarized-light",
    monaco: "vs",
    preview: { bg: "#fdf6e3", text: "#657b83", border: "#eee8d5", accent: "#268bd2" },
  },
  {
    id: "Monokai",
    label: "Monokai",
    mode: "dark",
    cssClass: "theme-monokai",
    monaco: "vs-dark",
    preview: { bg: "#272822", text: "#f8f8f2", border: "#3e3d32", accent: "#f92672" },
  },
  {
    id: "Gruvbox Dark",
    label: "Gruvbox Dark",
    mode: "dark",
    cssClass: "theme-gruvbox-dark",
    monaco: "vs-dark",
    preview: { bg: "#282828", text: "#ebdbb2", border: "#504945", accent: "#fe8019" },
  },
];

export const THEMES_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export const DEFAULT_THEME_ID = "Default Dark Modern";

export function resolveTheme(id: string | undefined | null): Theme {
  if (!id) return THEMES_BY_ID[DEFAULT_THEME_ID];
  const t = THEMES_BY_ID[id];
  if (t) return t;
  const fallback = id.toLowerCase().includes("light") ? "Default Light Modern" : DEFAULT_THEME_ID;
  return THEMES_BY_ID[fallback];
}
