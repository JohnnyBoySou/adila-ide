import { bench, describe } from "vitest";
import { sortEntries, type FileEntryLike } from "../features/explorer/sortEntries";

function makeEntries(n: number, dirRatio = 0.2): FileEntryLike[] {
  const out: FileEntryLike[] = [];
  for (let i = 0; i < n; i++) {
    const isDir = i % Math.round(1 / dirRatio) === 0;
    // Mix of letters/numbers/case so collator does work.
    const name = isDir
      ? `Dir_${(i % 7).toString(36)}_${i}`
      : `file_${(i % 11).toString(36)}_${i}.ts`;
    out.push({ name, path: `/r/${name}`, isDir });
  }
  return out;
}

const e50 = makeEntries(50);
const e500 = makeEntries(500);
const e5k = makeEntries(5_000);

const recentSubset = (entries: FileEntryLike[], take: number) =>
  entries.slice(0, take).map((e) => e.path);

describe("explorer — sortEntries (name-asc)", () => {
  bench("50 entries", () => {
    sortEntries(e50, "name-asc", []);
  });
  bench("500 entries", () => {
    sortEntries(e500, "name-asc", []);
  });
  bench("5k entries", () => {
    sortEntries(e5k, "name-asc", []);
  });
});

describe("explorer — sortEntries (name-desc)", () => {
  bench("500 entries", () => {
    sortEntries(e500, "name-desc", []);
  });
});

describe("explorer — sortEntries (recent)", () => {
  bench("500 entries · 50 recent", () => {
    sortEntries(e500, "recent", recentSubset(e500, 50));
  });
  bench("5k entries · 200 recent", () => {
    sortEntries(e5k, "recent", recentSubset(e5k, 200));
  });
});
