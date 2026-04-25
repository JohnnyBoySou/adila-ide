import type { PaletteItem } from "./types";

// Caches `${title} ${description}`.toLowerCase() per item so we don't
// rebuild it on every keystroke while the user types.
const haystacks = new WeakMap<PaletteItem, string>();

function haystackFor(item: PaletteItem): string {
  let h = haystacks.get(item);
  if (h === undefined) {
    h = `${item.title} ${item.description ?? ""}`.toLowerCase();
    haystacks.set(item, h);
  }
  return h;
}

export function filterCommands(items: PaletteItem[], search: string): PaletteItem[] {
  const q = search.trim().toLowerCase();
  if (!q) {
    return items;
  }
  const out: PaletteItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (haystackFor(item).includes(q)) {
      out.push(item);
    }
  }
  return out;
}
