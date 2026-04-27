import type * as monacoTypes from "monaco-editor";
import { ResolveImport, SymbolsForFile } from "../../../wailsjs/go/main/Indexer";

// definitionProvider.ts implementa "Go to Definition" (Ctrl+Click) pra
// JavaScript e TypeScript. Como o projeto não bunduja um LSP completo de
// TS, esse provider intercepta o pedido do Monaco e:
//
//   1. detecta o identificador sob o cursor;
//   2. acha a linha de import correspondente no arquivo atual;
//   3. extrai o module specifier (ex.: "@/components/SiteHeader");
//   4. delega resolução de path/extensões/aliases pro backend (Indexer.
//      ResolveImport, que lê tsconfig.json/paths);
//   5. consulta SymbolsForFile pra cair na linha exata do símbolo
//      (default 0:0 se não houver hit no índice).

const PROVIDER_LANGUAGES = ["typescript", "javascript"] as const;

const disposables = new Map<string, monacoTypes.IDisposable>();

type Monaco = typeof monacoTypes;

/** Registra o provider em todas as linguagens TS/JS. Idempotente. */
export function registerDefinitionProvider(monaco: Monaco) {
  for (const lang of PROVIDER_LANGUAGES) {
    if (disposables.has(lang)) continue;
    const d = monaco.languages.registerDefinitionProvider(lang, {
      provideDefinition: async (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;
        const symbol = word.word;

        const moduleSpec = findImportSpec(model.getValue(), symbol);
        if (!moduleSpec) return null;

        const currentPath = filePathFromModelUri(model.uri);
        if (!currentPath) return null;

        let resolved: string;
        try {
          resolved = await ResolveImport(currentPath, moduleSpec);
        } catch {
          return null;
        }
        if (!resolved) return null;

        // Refina pra linha do símbolo dentro do arquivo destino. Se o
        // indexer não tem o arquivo (ainda indexando, ou linguagem não
        // suportada), caímos em 1:1.
        let line = 1;
        let col = 1;
        try {
          const syms = await SymbolsForFile(resolved);
          const hit = syms.find((s) => s.name === symbol);
          if (hit) {
            line = hit.line + 1;
            col = hit.col + 1;
          }
        } catch {
          // ignora; usa 1:1
        }

        return [
          {
            uri: monaco.Uri.file(resolved),
            range: {
              startLineNumber: line,
              startColumn: col,
              endLineNumber: line,
              endColumn: col + symbol.length,
            },
          },
        ];
      },
    });
    disposables.set(lang, d);
  }
}

export function unregisterDefinitionProvider() {
  for (const d of disposables.values()) d.dispose();
  disposables.clear();
}

// ── parsing de imports ───────────────────────────────────────────────────

// Regex global que captura QUALQUER import statement, inclusive multi-linha.
// O `\s\S` aceita newlines no clause; `g` permite iteração via matchAll.
//
// Cobre:
//   import Foo from "..."
//   import { Foo, Bar } from "..."
//   import { Foo as Bar } from "..."
//   import * as Foo from "..."
//   import Default, { Named } from "..."
//   import {\n  A,\n  B,\n} from "..."
//
// Não cobre dynamic import("..."), require(...), nem export-from.
const IMPORT_STATEMENT = /import\s+([^"'`;]+?)\s+from\s+["']([^"']+)["']/g;

/**
 * Procura no source uma declaração de import que traga `symbol` e devolve
 * o module specifier. Retorna undefined se não encontrar — o Ctrl+Click
 * silenciosamente não navega.
 */
export function findImportSpec(source: string, symbol: string): string | undefined {
  IMPORT_STATEMENT.lastIndex = 0; // reseta estado da regex global entre chamadas
  let m: RegExpExecArray | null;
  while ((m = IMPORT_STATEMENT.exec(source)) !== null) {
    const clause = m[1].trim();
    const moduleSpec = m[2];
    if (clauseImports(clause, symbol)) {
      return moduleSpec;
    }
  }
  return undefined;
}

/** Verifica se a clause de import contém `symbol` (default, named ou ns). */
function clauseImports(clause: string, symbol: string): boolean {
  // Default-only: "Foo"
  if (!clause.includes("{") && !clause.includes("*")) {
    return clause.split(",")[0].trim() === symbol;
  }
  // Default + named: "Default, { A, B }"  → testa default primeiro
  if (clause.includes(",") && clause.includes("{")) {
    const [head, rest] = clause.split(/,(.+)/);
    if (head.trim() === symbol) return true;
    return namedClauseHas(rest, symbol);
  }
  // Namespace: "* as Foo"
  if (clause.startsWith("*")) {
    const m = /\*\s+as\s+(\w+)/.exec(clause);
    return !!m && m[1] === symbol;
  }
  // Named puro: "{ Foo, Bar as Baz }"
  return namedClauseHas(clause, symbol);
}

function namedClauseHas(clause: string, symbol: string): boolean {
  const inner = clause.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
  for (const raw of inner.split(",")) {
    const item = raw.trim();
    if (!item) continue;
    // "Foo as Bar" → o nome local é Bar (depois do `as`).
    const asMatch = /^(\w+)\s+as\s+(\w+)/.exec(item);
    if (asMatch) {
      if (asMatch[2] === symbol) return true;
      continue;
    }
    if (item === symbol) return true;
  }
  return false;
}

// ── Monaco URI → path absoluto ───────────────────────────────────────────

/**
 * Converte uma URI Monaco em path absoluto do filesystem. @monaco-editor/react
 * cria URIs no esquema "file" quando o `path` prop é absoluto, mas há
 * variantes (inmemory:, sem scheme) dependendo da versão; cobrimos os casos
 * comuns. Devolve string vazia se não der pra inferir.
 */
export function filePathFromModelUri(uri: monacoTypes.Uri): string {
  if (uri.scheme === "file" && uri.fsPath) return uri.fsPath;
  if (uri.path && uri.path.startsWith("/")) return uri.path;
  return "";
}
