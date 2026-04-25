import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export type EditorMarker = {
  severity: number; // 8=Error 4=Warning 2=Info 1=Hint
  message: string;
  startLineNumber: number;
  startColumn: number;
  source?: string;
};

type Props = {
  markers: Record<string, EditorMarker[]>;
  rootPath: string;
  onNavigate: (path: string, line: number, col: number) => void;
};

type FileSection = {
  path: string;
  relPath: string;
  fileMarkers: EditorMarker[];
  errors: number;
  warnings: number;
};

export function ProblemsPanel({ markers, rootPath, onNavigate }: Props) {
  const sections = useMemo<FileSection[]>(() => {
    const stripped = rootPath.replace(/\/$/, "") + "/";
    const out: FileSection[] = [];
    for (const path in markers) {
      const fileMarkers = markers[path];
      if (!fileMarkers || fileMarkers.length === 0) continue;
      let errors = 0;
      let warnings = 0;
      for (let i = 0; i < fileMarkers.length; i++) {
        const sev = fileMarkers[i].severity;
        if (sev === 8) errors++;
        else if (sev === 4) warnings++;
      }
      out.push({
        path,
        relPath: rootPath ? path.replace(stripped, "") : path,
        fileMarkers,
        errors,
        warnings,
      });
    }
    return out;
  }, [markers, rootPath]);

  if (sections.length === 0) {
    return <EmptyState icon={CheckCircle2} title="Nenhum problema detectado." className="h-full" />;
  }

  return (
    <div className="h-full overflow-y-auto text-xs">
      {sections.map(({ path: filePath, relPath, fileMarkers, errors, warnings }) => {
        return (
          <div key={filePath}>
            <div className="sticky top-0 px-3 py-1 font-medium text-[11px] text-foreground bg-muted/50 flex items-center gap-2 border-b">
              <span className="truncate flex-1">{relPath}</span>
              {errors > 0 && (
                <span className="text-destructive shrink-0">
                  {errors} erro{errors > 1 ? "s" : ""}
                </span>
              )}
              {warnings > 0 && (
                <span className="text-amber-500 shrink-0">
                  {warnings} aviso{warnings > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {fileMarkers.map((m, i) => (
              <button
                key={i}
                onClick={() => onNavigate(filePath, m.startLineNumber, m.startColumn)}
                className="w-full text-left flex items-start gap-2 px-5 py-1.5 hover:bg-accent border-b border-border/30"
              >
                {m.severity === 8 ? (
                  <XCircle className="size-3 text-destructive shrink-0 mt-0.5" />
                ) : m.severity === 4 ? (
                  <AlertTriangle className="size-3 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <Info className="size-3 text-blue-500 shrink-0 mt-0.5" />
                )}
                <span className="flex-1 break-words leading-relaxed">{m.message}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums mt-0.5">
                  {m.startLineNumber}:{m.startColumn}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
