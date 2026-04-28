import { ResolveImport, SymbolsForFile } from "../../../../wailsjs/go/main/Indexer";
import { findImportSpec } from "../definitionProvider";

type Position = { line: number; col: number };

export async function tryResolveImportDefinition(
  currentPath: string,
  source: string,
  pos: Position,
): Promise<{ path: string; line: number; col: number } | null> {
  const symbol = wordAtPosition(source, pos);
  if (!symbol) return null;
  const moduleSpec = findImportSpec(source, symbol);
  if (!moduleSpec) return null;

  let resolved = "";
  try {
    resolved = await ResolveImport(currentPath, moduleSpec);
  } catch {
    return null;
  }
  if (!resolved) return null;

  let line = 0;
  let col = 0;
  try {
    const symbols = await SymbolsForFile(resolved);
    const hit = symbols.find((s: { name: string }) => s.name === symbol);
    if (hit) {
      line = hit.line;
      col = hit.col;
    }
  } catch {
    // O indexer pode ainda não ter símbolos; abrir o arquivo já resolve o caso de import.
  }
  return { path: resolved, line, col };
}

function wordAtPosition(source: string, pos: Position): string {
  const line = source.split("\n")[pos.line] ?? "";
  const at = Math.max(0, Math.min(pos.col, line.length));
  let start = at;
  if (start > 0 && !/\w/.test(line[start] ?? "") && /\w/.test(line[start - 1] ?? "")) start--;
  while (start > 0 && /[\w$]/.test(line[start - 1] ?? "")) start--;
  let end = at;
  while (end < line.length && /[\w$]/.test(line[end] ?? "")) end++;
  return line.slice(start, end);
}
