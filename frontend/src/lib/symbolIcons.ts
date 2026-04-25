/**
 * Resolver de ícones do tema vscode-symbols (Miguel Solorio).
 * Os SVGs vivem em `frontend/public/symbol-icons/{files,folders}/`
 * e o mapeamento em `frontend/public/symbol-icons/theme.json`.
 *
 * O theme.json original referencia caminhos relativos `./icons/...` —
 * traduzimos para `/symbol-icons/...` no resolver.
 */

const ICON_BASE = "/symbol-icons";
const THEME_URL = `${ICON_BASE}/theme.json`;

type IconDef = { iconPath: string };

interface SymbolIconTheme {
  iconDefinitions: Record<string, IconDef>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  file: string;
  folder: string;
}

let themePromise: Promise<SymbolIconTheme> | null = null;

function loadTheme(): Promise<SymbolIconTheme> {
  if (!themePromise) {
    themePromise = fetch(THEME_URL)
      .then((r) => r.json() as Promise<SymbolIconTheme>)
      .catch((err) => {
        themePromise = null;
        throw err;
      });
  }
  return themePromise;
}

function defToUrl(theme: SymbolIconTheme, key: string): string | null {
  const def = theme.iconDefinitions[key];
  if (!def) return null;
  return def.iconPath.replace(/^\.\/icons\//, `${ICON_BASE}/`);
}

function resolveFileKey(theme: SymbolIconTheme, name: string): string {
  const lower = name.toLowerCase();
  if (theme.fileNames[lower]) return theme.fileNames[lower];
  // tenta extensões compostas primeiro (d.ts antes de ts)
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    if (theme.fileExtensions[ext]) return theme.fileExtensions[ext];
  }
  return theme.file;
}

function resolveFolderKey(theme: SymbolIconTheme, name: string): string {
  const lower = name.toLowerCase();
  return theme.folderNames[lower] ?? theme.folder;
}

export interface IconResolver {
  file(name: string): string | null;
  folder(name: string): string | null;
}

let resolverPromise: Promise<IconResolver> | null = null;

export function getIconResolver(): Promise<IconResolver> {
  if (!resolverPromise) {
    resolverPromise = loadTheme().then((theme) => ({
      file: (name: string) => defToUrl(theme, resolveFileKey(theme, name)),
      folder: (name: string) => defToUrl(theme, resolveFolderKey(theme, name)),
    }));
  }
  return resolverPromise;
}
