import { describe, expect, it, vi } from "vitest";
import { tryResolveImportDefinition } from "./definitionFallback";

vi.mock("../../../../wailsjs/go/main/Indexer", () => ({
  ResolveImport: vi.fn(async (_currentPath: string, moduleSpec: string) => {
    if (moduleSpec === "@/toolbox") return "/workspace/src/toolbox/index.ts";
    if (moduleSpec === "zod") return "/workspace/node_modules/zod/index.d.ts";
    return "";
  }),
  SymbolsForFile: vi.fn(async () => [
    { name: "ToolBox", line: 7, col: 13 },
    { name: "z", line: 2, col: 20 },
  ]),
}));

describe("tryResolveImportDefinition", () => {
  it("resolve imports nomeados com alias tsconfig via Indexer.ResolveImport", async () => {
    const source = 'import { ToolBox } from "@/toolbox";\n\n<ToolBox />';

    await expect(
      tryResolveImportDefinition("/workspace/src/App.tsx", source, { line: 2, col: 2 }),
    ).resolves.toEqual({
      path: "/workspace/src/toolbox/index.ts",
      line: 7,
      col: 13,
    });
  });

  it("delegates bare package imports to Indexer.ResolveImport", async () => {
    const source = 'import { z } from "zod";\n\nconst schema = z.object({});';

    await expect(
      tryResolveImportDefinition("/workspace/src/App.tsx", source, { line: 2, col: 15 }),
    ).resolves.toEqual({
      path: "/workspace/node_modules/zod/index.d.ts",
      line: 2,
      col: 20,
    });
  });
});
