import { bench, describe } from "vitest";
import { filterCommands } from "../features/command-palette/filterCommands";
import type { PaletteItem } from "../features/command-palette/types";

function makeCommands(n: number): PaletteItem[] {
  const verbs = [
    "open",
    "close",
    "save",
    "format",
    "toggle",
    "show",
    "hide",
    "go to",
    "find",
    "replace",
  ];
  const nouns = [
    "file",
    "terminal",
    "settings",
    "panel",
    "tab",
    "git",
    "branch",
    "symbol",
    "definition",
    "references",
  ];
  const out: PaletteItem[] = [];
  for (let i = 0; i < n; i++) {
    const verb = verbs[i % verbs.length];
    const noun = nouns[(i / verbs.length) | 0 % nouns.length];
    out.push({
      id: `cmd.${i}`,
      title: `${verb} ${noun} #${i}`,
      description: `Action ${i}: performs ${verb} on ${noun}.`,
      icon: "command",
    });
  }
  return out;
}

const cmd50 = makeCommands(50);
const cmd200 = makeCommands(200);
const cmd1k = makeCommands(1_000);

describe("palette — filterCommands (warm cache)", () => {
  bench("50 cmds · 'open'", () => {
    filterCommands(cmd50, "open");
  });
  bench("200 cmds · 'open'", () => {
    filterCommands(cmd200, "open");
  });
  bench("1k cmds · 'open'", () => {
    filterCommands(cmd1k, "open");
  });
  bench("200 cmds · 'zzzzz' (no match)", () => {
    filterCommands(cmd200, "zzzzz");
  });
  bench("200 cmds · empty (passthrough)", () => {
    filterCommands(cmd200, "");
  });
});
