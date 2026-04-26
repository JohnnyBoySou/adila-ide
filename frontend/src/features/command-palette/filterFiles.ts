import type { FileEntry } from "./rpc";
import type { PaletteItem } from "./types";

export const FILES_MAX_RESULTS = 128;

export function filterFiles(files: FileEntry[], roots: FileEntry[], search: string): PaletteItem[] {
  if (files.length === 0) {
    return [];
  }
  const rootPaths = roots
    .map((r) => (r.path.endsWith("/") ? r.path : `${r.path}/`))
    .sort((a, b) => b.length - a.length);
  const toRel = (path: string): string => {
    for (const root of rootPaths) {
      if (path.startsWith(root)) {
        return path.slice(root.length);
      }
    }
    return path;
  };

  const q = search.trim().toLowerCase();
  if (!q) {
    const limit = Math.min(files.length, FILES_MAX_RESULTS);
    const out = new Array<PaletteItem>(limit);
    for (let i = 0; i < limit; i++) {
      const f = files[i];
      out[i] = { id: f.path, title: f.name, description: toRel(f.path), icon: "file" };
    }
    return out;
  }

  // Score: lower is better. Prefer matches in the filename, then in the
  // relative path. Files that don't contain every character of the query
  // (in order) are filtered out entirely. We defer PaletteItem allocation
  // until after the sort so we don't create objects we'll discard.
  const scored: Array<{ file: FileEntry; rel: string; score: number }> = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const rel = toRel(f.path);
    const lowerRel = rel.toLowerCase();
    const lowerName = f.name.toLowerCase();
    const nameIdx = lowerName.indexOf(q);
    const relIdx = lowerRel.indexOf(q);
    if (nameIdx < 0 && relIdx < 0) {
      if (!subsequenceMatch(lowerRel, q)) {
        continue;
      }
      scored.push({ file: f, rel, score: 500 });
      continue;
    }
    const score = nameIdx >= 0 ? nameIdx : 100 + (relIdx >= 0 ? relIdx : 0);
    scored.push({ file: f, rel, score });
  }
  scored.sort((a, b) => a.score - b.score);
  const limit = Math.min(scored.length, FILES_MAX_RESULTS);
  const out = new Array<PaletteItem>(limit);
  for (let i = 0; i < limit; i++) {
    const s = scored[i];
    out[i] = { id: s.file.path, title: s.file.name, description: s.rel, icon: "file" };
  }
  return out;
}

function subsequenceMatch(haystack: string, needle: string): boolean {
  const nlen = needle.length;
  if (nlen === 0) {
    return true;
  }
  let i = 0;
  let target = needle.charCodeAt(0);
  for (let h = 0; h < haystack.length; h++) {
    if (haystack.charCodeAt(h) === target) {
      i++;
      if (i === nlen) {
        return true;
      }
      target = needle.charCodeAt(i);
    }
  }
  return false;
}
