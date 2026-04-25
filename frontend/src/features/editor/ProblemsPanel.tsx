import { AlertTriangle, Info, XCircle } from "lucide-react";

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

export function ProblemsPanel({ markers, rootPath, onNavigate }: Props) {
  const entries = Object.entries(markers).filter(([, m]) => m.length > 0);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Nenhum problema detectado.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto text-xs">
      {entries.map(([filePath, fileMarkers]) => {
        const relPath = rootPath
          ? filePath.replace(rootPath.replace(/\/$/, "") + "/", "")
          : filePath;
        const errors = fileMarkers.filter((m) => m.severity === 8).length;
        const warnings = fileMarkers.filter((m) => m.severity === 4).length;

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
