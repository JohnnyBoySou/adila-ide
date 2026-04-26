/**
 * Sistema de temas de ícones para arquivos/pastas.
 *
 * Dois tipos de tema:
 *  - URL-based: SVGs servidos de /icon-themes/<id>/, mapeamento via theme.json
 *    no formato VSCode icon theme (vscode-symbols, material, vscode-icons…).
 *  - Code-based: resolve para um ícone Lucide via {kind:"lucide", name}. Usado
 *    pelo tema "minimal" — sem assets, alinha com a UI Lucide.
 *
 * Assets em public/icon-themes/<id>/{theme.json,files/,folders/}.
 */

import type { LucideIcon } from "lucide-react";
import {
  Braces,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileCog,
  FileImage,
  FileText,
  FileType,
  FileVideo,
  Folder,
  FolderOpen,
  Hash,
  Lock,
} from "lucide-react";

export type IconResolution =
  | { kind: "url"; url: string }
  | { kind: "lucide"; icon: LucideIcon; color?: string };

export interface IconResolver {
  file(name: string): IconResolution | null;
  folder(name: string): IconResolution | null;
}

export type IconThemeId = "symbols" | "minimal";

export const ICON_THEME_OPTIONS: { value: IconThemeId; label: string }[] = [
  { value: "symbols", label: "Symbols (Miguel Solorio)" },
  { value: "minimal", label: "Minimal (Lucide)" },
];

// ── URL-based: VSCode-compatible theme.json loader ──────────────────────────

interface VscodeIconTheme {
  iconDefinitions: Record<string, { iconPath: string }>;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  file: string;
  folder: string;
}

async function loadUrlTheme(themeId: string): Promise<IconResolver> {
  const base = `/icon-themes/${themeId}`;
  const theme = (await fetch(`${base}/theme.json`).then((r) =>
    r.json(),
  )) as VscodeIconTheme;

  const defToUrl = (key: string): string | null => {
    const def = theme.iconDefinitions[key];
    if (!def) return null;
    return def.iconPath.replace(/^\.\/icons\//, `${base}/`);
  };

  const resolveFileKey = (name: string): string => {
    const lower = name.toLowerCase();
    if (theme.fileNames[lower]) return theme.fileNames[lower];
    const parts = lower.split(".");
    for (let i = 1; i < parts.length; i++) {
      const ext = parts.slice(i).join(".");
      if (theme.fileExtensions[ext]) return theme.fileExtensions[ext];
    }
    return theme.file;
  };

  const resolveFolderKey = (name: string): string => {
    const lower = name.toLowerCase();
    return theme.folderNames[lower] ?? theme.folder;
  };

  return {
    file: (name) => {
      const url = defToUrl(resolveFileKey(name));
      return url ? { kind: "url", url } : null;
    },
    folder: (name) => {
      const url = defToUrl(resolveFolderKey(name));
      return url ? { kind: "url", url } : null;
    },
  };
}

// ── Code-based: Lucide minimal theme ────────────────────────────────────────

type LucideMapping = { icon: LucideIcon; color?: string };

const MINIMAL_EXT: Record<string, LucideMapping> = {
  ts: { icon: FileCode, color: "text-blue-400" },
  tsx: { icon: FileCode, color: "text-blue-400" },
  js: { icon: FileCode, color: "text-yellow-400" },
  jsx: { icon: FileCode, color: "text-yellow-400" },
  mjs: { icon: FileCode, color: "text-yellow-400" },
  cjs: { icon: FileCode, color: "text-yellow-400" },
  go: { icon: FileCode, color: "text-cyan-400" },
  rs: { icon: FileCode, color: "text-orange-400" },
  py: { icon: FileCode, color: "text-emerald-400" },
  rb: { icon: FileCode, color: "text-rose-400" },
  java: { icon: FileCode, color: "text-orange-300" },
  c: { icon: FileCode, color: "text-blue-300" },
  cpp: { icon: FileCode, color: "text-blue-300" },
  h: { icon: FileCode, color: "text-blue-300" },
  hpp: { icon: FileCode, color: "text-blue-300" },
  cs: { icon: FileCode, color: "text-violet-400" },
  swift: { icon: FileCode, color: "text-orange-400" },
  kt: { icon: FileCode, color: "text-violet-400" },
  php: { icon: FileCode, color: "text-violet-300" },
  lua: { icon: FileCode, color: "text-blue-400" },
  zig: { icon: FileCode, color: "text-amber-400" },
  json: { icon: Braces, color: "text-amber-400" },
  jsonc: { icon: Braces, color: "text-amber-400" },
  yaml: { icon: Braces, color: "text-rose-300" },
  yml: { icon: Braces, color: "text-rose-300" },
  toml: { icon: Braces, color: "text-zinc-300" },
  xml: { icon: FileCode, color: "text-emerald-300" },
  html: { icon: FileCode, color: "text-orange-400" },
  css: { icon: FileCode, color: "text-sky-400" },
  scss: { icon: FileCode, color: "text-pink-400" },
  sass: { icon: FileCode, color: "text-pink-400" },
  less: { icon: FileCode, color: "text-blue-400" },
  md: { icon: FileText, color: "text-zinc-200" },
  mdx: { icon: FileText, color: "text-zinc-200" },
  txt: { icon: FileText },
  pdf: { icon: FileText, color: "text-rose-400" },
  png: { icon: FileImage, color: "text-violet-300" },
  jpg: { icon: FileImage, color: "text-violet-300" },
  jpeg: { icon: FileImage, color: "text-violet-300" },
  gif: { icon: FileImage, color: "text-violet-300" },
  svg: { icon: FileImage, color: "text-amber-300" },
  webp: { icon: FileImage, color: "text-violet-300" },
  ico: { icon: FileImage, color: "text-violet-300" },
  mp3: { icon: FileAudio, color: "text-emerald-300" },
  wav: { icon: FileAudio, color: "text-emerald-300" },
  flac: { icon: FileAudio, color: "text-emerald-300" },
  ogg: { icon: FileAudio, color: "text-emerald-300" },
  mp4: { icon: FileVideo, color: "text-rose-300" },
  mov: { icon: FileVideo, color: "text-rose-300" },
  webm: { icon: FileVideo, color: "text-rose-300" },
  zip: { icon: FileArchive, color: "text-amber-400" },
  tar: { icon: FileArchive, color: "text-amber-400" },
  gz: { icon: FileArchive, color: "text-amber-400" },
  rar: { icon: FileArchive, color: "text-amber-400" },
  "7z": { icon: FileArchive, color: "text-amber-400" },
  ttf: { icon: FileType, color: "text-zinc-300" },
  otf: { icon: FileType, color: "text-zinc-300" },
  woff: { icon: FileType, color: "text-zinc-300" },
  woff2: { icon: FileType, color: "text-zinc-300" },
  sh: { icon: Hash, color: "text-emerald-400" },
  bash: { icon: Hash, color: "text-emerald-400" },
  zsh: { icon: Hash, color: "text-emerald-400" },
  fish: { icon: Hash, color: "text-emerald-400" },
  env: { icon: Lock, color: "text-amber-300" },
  lock: { icon: Lock, color: "text-zinc-400" },
};

const MINIMAL_FILENAMES: Record<string, LucideMapping> = {
  "package.json": { icon: Braces, color: "text-rose-400" },
  "tsconfig.json": { icon: Braces, color: "text-blue-400" },
  "dockerfile": { icon: FileCog, color: "text-sky-400" },
  ".gitignore": { icon: FileCog, color: "text-zinc-400" },
  ".env": { icon: Lock, color: "text-amber-300" },
  "readme.md": { icon: FileText, color: "text-blue-300" },
  "license": { icon: FileText, color: "text-zinc-300" },
  "makefile": { icon: FileCog, color: "text-zinc-300" },
};

function minimalResolveFile(name: string): IconResolution {
  const lower = name.toLowerCase();
  const byName = MINIMAL_FILENAMES[lower];
  if (byName) return { kind: "lucide", ...byName };
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const ext = parts.slice(i).join(".");
    const byExt = MINIMAL_EXT[ext];
    if (byExt) return { kind: "lucide", ...byExt };
  }
  return { kind: "lucide", icon: File, color: "text-muted-foreground" };
}

function minimalResolveFolder(name: string): IconResolution {
  // Diferencia algumas pastas comuns; resto cai em Folder genérico.
  const lower = name.toLowerCase();
  if (lower === "node_modules" || lower === ".git" || lower === "dist" || lower === "build") {
    return { kind: "lucide", icon: Folder, color: "text-muted-foreground/60" };
  }
  if (lower === "src" || lower === "app" || lower === "lib") {
    return { kind: "lucide", icon: FolderOpen, color: "text-blue-400" };
  }
  return { kind: "lucide", icon: Folder, color: "text-zinc-400" };
}

const minimalResolver: IconResolver = {
  file: (name) => minimalResolveFile(name),
  folder: (name) => minimalResolveFolder(name),
};

// ── Resolver registry + cache ───────────────────────────────────────────────

const resolverCache = new Map<IconThemeId, Promise<IconResolver>>();

export function getIconResolver(themeId: IconThemeId): Promise<IconResolver> {
  let cached = resolverCache.get(themeId);
  if (cached) return cached;

  if (themeId === "minimal") {
    cached = Promise.resolve(minimalResolver);
  } else {
    cached = loadUrlTheme(themeId).catch((err) => {
      resolverCache.delete(themeId);
      throw err;
    });
  }
  resolverCache.set(themeId, cached);
  return cached;
}
