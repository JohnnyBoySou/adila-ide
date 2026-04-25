export interface FileEntryLike {
  name: string;
  path: string;
  isDir: boolean;
}

export type SortMode = "name-asc" | "name-desc" | "recent";

// Schwartzian: precompute a lowercased key once per entry, then compare
// keys with `<`/`>` (V8 fast path for short strings) instead of calling
// localeCompare/Intl.Collator on every pairwise comparison. For 5k items
// this collapses 60k+ comparator calls down to one toLowerCase per entry.

export function sortEntries<T extends FileEntryLike>(
  entries: T[],
  sort: SortMode,
  recentPaths: string[],
): T[] {
  const n = entries.length;
  if (n <= 1) {
    return entries.slice();
  }

  if (sort === "recent") {
    return sortByRecent(entries, recentPaths);
  }

  const desc = sort === "name-desc";
  // Partition dirs/files so each gets sorted independently — and we
  // skip the per-comparison `isDir` branch entirely.
  const dirs: Array<{ e: T; k: string }> = [];
  const files: Array<{ e: T; k: string }> = [];
  for (let i = 0; i < n; i++) {
    const e = entries[i];
    const wrapped = { e, k: e.name.toLowerCase() };
    if (e.isDir) {
      dirs.push(wrapped);
    } else {
      files.push(wrapped);
    }
  }
  const cmp = desc
    ? (a: { k: string }, b: { k: string }) => (a.k < b.k ? 1 : a.k > b.k ? -1 : 0)
    : (a: { k: string }, b: { k: string }) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0);
  dirs.sort(cmp);
  files.sort(cmp);

  const out = new Array<T>(n);
  for (let i = 0; i < dirs.length; i++) {
    out[i] = dirs[i].e;
  }
  const offset = dirs.length;
  for (let i = 0; i < files.length; i++) {
    out[offset + i] = files[i].e;
  }
  return out;
}

function sortByRecent<T extends FileEntryLike>(entries: T[], recentPaths: string[]): T[] {
  const idx = new Map<string, number>();
  for (let i = 0; i < recentPaths.length; i++) {
    idx.set(recentPaths[i], i);
  }
  const decorated: Array<{ e: T; k: string; r: number }> = new Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    decorated[i] = { e, k: e.name.toLowerCase(), r: idx.get(e.path) ?? Infinity };
  }
  decorated.sort((a, b) => {
    if (a.r !== b.r) {
      return a.r - b.r;
    }
    if (a.e.isDir !== b.e.isDir) {
      return a.e.isDir ? -1 : 1;
    }
    return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
  });
  const out = new Array<T>(entries.length);
  for (let i = 0; i < decorated.length; i++) {
    out[i] = decorated[i].e;
  }
  return out;
}
