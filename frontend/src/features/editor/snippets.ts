import type * as monacoTypes from "monaco-editor";

type Snippet = {
  prefix: string;
  body: string;
  description: string;
};

const JS_TS_SNIPPETS: Snippet[] = [
  { prefix: "clog", body: "console.log($1);$0", description: "console.log" },
  { prefix: "cwarn", body: "console.warn($1);$0", description: "console.warn" },
  { prefix: "cerr", body: "console.error($1);$0", description: "console.error" },
  { prefix: "cdir", body: "console.dir($1);$0", description: "console.dir" },
  { prefix: "ctable", body: "console.table($1);$0", description: "console.table" },
  {
    prefix: "func",
    body: "function ${1:name}(${2:args}) {\n\t$0\n}",
    description: "Function declaration",
  },
  { prefix: "afn", body: "(${1:args}) => {\n\t$0\n}", description: "Arrow function" },
  {
    prefix: "try",
    body: "try {\n\t$1\n} catch (${2:err}) {\n\t$0\n}",
    description: "try/catch block",
  },
  { prefix: "if", body: "if (${1:condition}) {\n\t$0\n}", description: "if statement" },
  {
    prefix: "ifelse",
    body: "if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}",
    description: "if/else statement",
  },
  {
    prefix: "for",
    body: "for (let ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t$0\n}",
    description: "for loop",
  },
  {
    prefix: "forof",
    body: "for (const ${1:item} of ${2:items}) {\n\t$0\n}",
    description: "for...of loop",
  },
  {
    prefix: "forin",
    body: "for (const ${1:key} in ${2:object}) {\n\t$0\n}",
    description: "for...in loop",
  },
  { prefix: "imp", body: 'import { $2 } from "$1";$0', description: "Named import" },
  { prefix: "eimp", body: 'import $2 from "$1";$0', description: "Default import" },
  {
    prefix: "ase",
    body: "async (${1:args}) => {\n\t$0\n}",
    description: "Async arrow function",
  },
  {
    prefix: "asf",
    body: "async function ${1:name}(${2:args}) {\n\t$0\n}",
    description: "Async function declaration",
  },
];

const TSX_SNIPPETS: Snippet[] = [
  {
    prefix: "useState",
    body: "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState($2);$0",
    description: "React useState hook",
  },
  {
    prefix: "useEffect",
    body: "useEffect(() => {\n\t$0\n}, [$1]);",
    description: "React useEffect hook",
  },
  {
    prefix: "useMemo",
    body: "const ${1:value} = useMemo(() => {\n\treturn $2;\n}, [$3]);$0",
    description: "React useMemo hook",
  },
  {
    prefix: "useCallback",
    body: "const ${1:fn} = useCallback((${2:args}) => {\n\t$0\n}, [$3]);",
    description: "React useCallback hook",
  },
  {
    prefix: "useRef",
    body: "const ${1:ref} = useRef<${2:HTMLDivElement}>(null);$0",
    description: "React useRef hook",
  },
  {
    prefix: "rfc",
    body: "export function ${1:Name}() {\n\treturn (\n\t\t<div>$0</div>\n\t);\n}",
    description: "React function component",
  },
];

const GO_SNIPPETS: Snippet[] = [
  {
    prefix: "iferr",
    body: "if err != nil {\n\treturn ${1:err}\n}\n$0",
    description: "if err != nil { return err }",
  },
  {
    prefix: "iferrn",
    body: "if err != nil {\n\treturn nil, ${1:err}\n}\n$0",
    description: "if err != nil { return nil, err }",
  },
  {
    prefix: "forr",
    body: "for ${1:i}, ${2:v} := range ${3:slice} {\n\t$0\n}",
    description: "for range loop",
  },
  {
    prefix: "fn",
    body: "func ${1:name}(${2:args}) ${3:type} {\n\t$0\n}",
    description: "Function declaration",
  },
  {
    prefix: "mfn",
    body: "func (${1:r} ${2:Receiver}) ${3:Name}(${4:args}) ${5:type} {\n\t$0\n}",
    description: "Method declaration",
  },
  {
    prefix: "stc",
    body: "type ${1:Name} struct {\n\t$0\n}",
    description: "Struct declaration",
  },
];

const COMMON_SNIPPETS: Snippet[] = [
  { prefix: "todo", body: "// TODO: $0", description: "TODO comment" },
  { prefix: "fixme", body: "// FIXME: $0", description: "FIXME comment" },
];

const SNIPPETS_BY_LANG: Record<string, Snippet[]> = {
  javascript: [...JS_TS_SNIPPETS, ...COMMON_SNIPPETS],
  typescript: [...JS_TS_SNIPPETS, ...TSX_SNIPPETS, ...COMMON_SNIPPETS],
  go: [...GO_SNIPPETS, ...COMMON_SNIPPETS],
};

type UserSnippet = Snippet & { languages?: string[] };

let registered = false;
const disposables: Array<{ dispose: () => void }> = [];

function parseUserSnippets(raw: string): UserSnippet[] {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is UserSnippet =>
          s != null &&
          typeof s === "object" &&
          typeof (s as UserSnippet).prefix === "string" &&
          typeof (s as UserSnippet).body === "string",
      )
      .map((s) => ({
        prefix: s.prefix,
        body: s.body,
        description: s.description ?? "user snippet",
        languages: Array.isArray(s.languages) ? s.languages : undefined,
      }));
  } catch {
    return [];
  }
}

function snippetsForLang(lang: string, userJson: string): Snippet[] {
  const builtin = SNIPPETS_BY_LANG[lang] ?? [];
  const userAll = parseUserSnippets(userJson);
  const user = userAll.filter((s) => !s.languages || s.languages.includes(lang));
  return [...builtin, ...user];
}

export function registerSnippets(monaco: typeof monacoTypes, userJson = "[]") {
  if (registered) return;
  registered = true;

  const langs = new Set([
    ...Object.keys(SNIPPETS_BY_LANG),
    ...parseUserSnippets(userJson).flatMap((s) => s.languages ?? ["typescript", "javascript"]),
  ]);

  for (const lang of langs) {
    const items = snippetsForLang(lang, userJson);
    if (items.length === 0) continue;
    const d = monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        );
        const suggestions: monacoTypes.languages.CompletionItem[] = items.map((s) => ({
          label: s.prefix,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: s.description,
          detail: "snippet",
          range,
        }));
        return { suggestions };
      },
    });
    disposables.push(d);
  }
}

export function unregisterSnippets() {
  for (const d of disposables) {
    d.dispose();
  }
  disposables.length = 0;
  registered = false;
}
