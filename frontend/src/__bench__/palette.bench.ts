import { bench, describe } from "vitest";
import { filterFiles } from "../features/command-palette/filterFiles";
import type { FileEntry } from "../features/command-palette/rpc";

const ROOT = "/home/user/projects/big-monorepo";
const ROOTS: FileEntry[] = [{ name: "big-monorepo", path: ROOT, isDirectory: true }];

function makeFiles(n: number): FileEntry[] {
  const out: FileEntry[] = [];
  const dirs = ["src", "lib", "components", "features", "hooks", "utils", "tests"];
  const exts = [".ts", ".tsx", ".js", ".css", ".md", ".json"];
  for (let i = 0; i < n; i++) {
    const d1 = dirs[i % dirs.length];
    const d2 = dirs[(i / 7) | 0 % dirs.length];
    const ext = exts[i % exts.length];
    const name = `file_${i.toString(36)}_${d1.slice(0, 2)}${ext}`;
    out.push({
      name,
      path: `${ROOT}/${d1}/${d2}/${name}`,
      isDirectory: false,
    });
  }
  return out;
}

const files100 = makeFiles(100);
const files1k = makeFiles(1_000);
const files10k = makeFiles(10_000);

describe("palette — filterFiles (empty query, just slice+map)", () => {
  bench("100 files", () => {
    filterFiles(files100, ROOTS, "");
  });
  bench("1k files", () => {
    filterFiles(files1k, ROOTS, "");
  });
  bench("10k files", () => {
    filterFiles(files10k, ROOTS, "");
  });
});

describe("palette — filterFiles (literal hit on name)", () => {
  bench("100 files · 'file'", () => {
    filterFiles(files100, ROOTS, "file");
  });
  bench("1k files · 'file'", () => {
    filterFiles(files1k, ROOTS, "file");
  });
  bench("10k files · 'file'", () => {
    filterFiles(files10k, ROOTS, "file");
  });
});

describe("palette — filterFiles (specific suffix match)", () => {
  bench("1k files · '.tsx'", () => {
    filterFiles(files1k, ROOTS, ".tsx");
  });
  bench("10k files · '.tsx'", () => {
    filterFiles(files10k, ROOTS, ".tsx");
  });
});

describe("palette — filterFiles (subsequence match, no literal)", () => {
  bench("1k files · 'src+sf'", () => {
    filterFiles(files1k, ROOTS, "srcsf");
  });
  bench("10k files · 'src+sf'", () => {
    filterFiles(files10k, ROOTS, "srcsf");
  });
});

describe("palette — filterFiles (no match)", () => {
  bench("10k files · 'zzzzzzzzz'", () => {
    filterFiles(files10k, ROOTS, "zzzzzzzzz");
  });
});
