import { useEffect, useMemo, useRef, useState } from "react";
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  Loader2,
  Regex,
  Replace as ReplaceIcon,
  Search as SearchIcon,
  WholeWord,
} from "lucide-react";
import { searchRpc, type SearchMatch } from "./rpc";

type Props = {
  rootPath: string;
  onOpenMatch: (path: string, line: number, column: number) => void;
};

type Grouped = Map<string, SearchMatch[]>;

function groupByFile(matches: SearchMatch[]): Grouped {
  const out: Grouped = new Map();
  for (const m of matches) {
    const arr = out.get(m.path);
    if (arr) arr.push(m);
    else out.set(m.path, [m]);
  }
  return out;
}

export function SearchView({ rootPath, onOpenMatch }: Props) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [regex, setRegex] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [replacing, setReplacing] = useState(false);
  const [replaceMsg, setReplaceMsg] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);

  const opts = useMemo(
    () => ({
      query,
      caseSensitive,
      wholeWord,
      regex,
      maxResults: 1000,
    }),
    [query, caseSensitive, wholeWord, regex],
  );

  useEffect(() => {
    if (!rootPath || !query) {
      setMatches([]);
      setError(null);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await searchRpc.search(rootPath, opts);
        setMatches(result || []);
      } catch (e) {
        setMatches([]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [rootPath, opts]);

  const grouped = useMemo(() => groupByFile(matches), [matches]);
  const totalFiles = grouped.size;
  const totalMatches = matches.length;

  const toggleFile = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const replaceAll = async () => {
    if (!rootPath || !query || replacing) return;
    setReplacing(true);
    setReplaceMsg(null);
    try {
      const n = await searchRpc.replace(rootPath, opts, replacement);
      setReplaceMsg(`${n} ocorrência${n === 1 ? "" : "s"} substituída${n === 1 ? "" : "s"}.`);
      const fresh = await searchRpc.search(rootPath, opts);
      setMatches(fresh || []);
    } catch (e) {
      setReplaceMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="h-full flex flex-col text-sm">
      <div className="px-2 py-2 space-y-2 border-b">
        <div className="flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1 border rounded-md px-2 py-1 bg-background focus-within:ring-1 focus-within:ring-ring">
            <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="flex-1 bg-transparent outline-none min-w-0"
              autoFocus
            />
            <ToggleIcon
              active={caseSensitive}
              onClick={() => setCaseSensitive((v) => !v)}
              title="Case sensitive"
              Icon={CaseSensitive}
            />
            <ToggleIcon
              active={wholeWord}
              onClick={() => setWholeWord((v) => !v)}
              title="Palavra inteira"
              Icon={WholeWord}
            />
            <ToggleIcon
              active={regex}
              onClick={() => setRegex((v) => !v)}
              title="Regex"
              Icon={Regex}
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1 border rounded-md px-2 py-1 bg-background focus-within:ring-1 focus-within:ring-ring">
            <ReplaceIcon className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Substituir"
              className="flex-1 bg-transparent outline-none min-w-0"
            />
          </div>
          <button
            onClick={replaceAll}
            disabled={!query || replacing || totalMatches === 0}
            className="px-2 py-1 text-xs rounded-md border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            title="Substituir todos"
          >
            {replacing ? <Loader2 className="size-3.5 animate-spin" /> : "Tudo"}
          </button>
        </div>
        <div className="text-xs text-muted-foreground min-h-[1.25rem]">
          {!rootPath ? (
            "Abra uma pasta para buscar."
          ) : loading ? (
            "Buscando…"
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : query ? (
            `${totalMatches} resultado${totalMatches === 1 ? "" : "s"} em ${totalFiles} arquivo${totalFiles === 1 ? "" : "s"}`
          ) : (
            "Digite para buscar."
          )}
          {replaceMsg && <span className="ml-2">· {replaceMsg}</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {Array.from(grouped.entries()).map(([path, fileMatches]) => {
          const isCollapsed = collapsed.has(path);
          const name = path.split("/").pop() ?? path;
          const dir = path.slice(0, path.length - name.length).replace(rootPath + "/", "");
          return (
            <div key={path} className="border-b last:border-b-0">
              <div
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "copy";
                  e.dataTransfer.setData(
                    "application/x-adila-file",
                    JSON.stringify({ path, name }),
                  );
                }}
                onClick={() => toggleFile(path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleFile(path);
                  }
                }}
                className="w-full flex items-center gap-1 px-2 py-1 hover:bg-accent text-left cursor-pointer select-none"
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3 shrink-0" />
                ) : (
                  <ChevronDown className="size-3 shrink-0" />
                )}
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{dir}</span>
                <span className="ml-auto text-xs text-muted-foreground shrink-0">
                  {fileMatches.length}
                </span>
              </div>
              {!isCollapsed && (
                <ul>
                  {fileMatches.map((m, i) => (
                    <li key={`${m.line}-${m.column}-${i}`}>
                      <button
                        onClick={() => onOpenMatch(m.path, m.line, m.column)}
                        className="w-full flex gap-2 px-6 py-1 text-xs hover:bg-accent text-left font-mono"
                      >
                        <span className="text-muted-foreground shrink-0 w-8 text-right">
                          {m.line}
                        </span>
                        <span className="truncate">{m.preview}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToggleIcon({
  active,
  onClick,
  title,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  Icon: typeof CaseSensitive;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        "p-0.5 rounded text-xs " +
        (active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="size-3.5" />
    </button>
  );
}
