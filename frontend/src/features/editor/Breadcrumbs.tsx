import { ChevronRight } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { ListDir } from "../../../wailsjs/go/main/App";

type FileEntry = { name: string; path: string; isDir: boolean };

type Props = {
  path: string;
  rootPath: string;
  onOpenFile: (path: string) => void;
};

type Crumb = { label: string; dirPath: string; isLast: boolean };

export const Breadcrumbs = memo(function Breadcrumbs({ path, rootPath, onOpenFile }: Props) {
  const [dropdownDir, setDropdownDir] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dropdownPos, setDropdownPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const rel = rootPath ? path.replace(rootPath.replace(/\/$/, "") + "/", "") : path;
  const parts = rel.split("/").filter(Boolean);

  const crumbs: Crumb[] = parts.map((label, i) => {
    const isLast = i === parts.length - 1;
    const dirPath = isLast
      ? path.split("/").slice(0, -1).join("/") || "/"
      : rootPath + "/" + parts.slice(0, i + 1).join("/");
    return { label, dirPath, isLast };
  });

  useEffect(() => {
    if (!dropdownDir) return;
    ListDir(dropdownDir)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [dropdownDir]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!dropdownDir) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setDropdownDir(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownDir]);

  if (parts.length === 0) return null;

  const openDropdown = (dirPath: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropdownPos({ x: rect.left, y: rect.bottom + 2 });
    setDropdownDir(dirPath === dropdownDir ? null : dirPath);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 px-3 py-0.5 text-xs text-muted-foreground border-b bg-background overflow-x-auto"
      style={{ scrollbarWidth: "none" }}
    >
      {crumbs.map(({ label, dirPath, isLast }) => (
        <span key={dirPath} className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => openDropdown(dirPath, e)}
            className={
              "px-1 py-0.5 rounded hover:bg-accent transition-colors " +
              (isLast ? "text-foreground font-medium" : "hover:text-foreground")
            }
          >
            {label}
          </button>
          {!isLast && <ChevronRight className="size-3 opacity-40" />}
        </span>
      ))}

      {/* Dropdown de arquivos do diretório */}
      {dropdownDir && (
        <div
          className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-48 max-h-64 overflow-y-auto"
          style={{ left: dropdownPos.x, top: dropdownPos.y }}
        >
          {entries.length === 0 ? (
            <div className="px-3 py-2 text-muted-foreground">Vazio</div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                onClick={() => {
                  if (!entry.isDir) onOpenFile(entry.path);
                  setDropdownDir(null);
                }}
                className={
                  "w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-accent transition-colors " +
                  (entry.path === path ? "text-primary font-medium" : "")
                }
              >
                {entry.isDir ? "📁" : "📄"}
                <span className="truncate">{entry.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
