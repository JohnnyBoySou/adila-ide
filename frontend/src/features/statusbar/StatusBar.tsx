import { AlertTriangle, Bell, BellDot, GitBranch, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LSPStatus } from "@/features/editor/LSPStatus";
import { useNotificationCount } from "./useNotificationCount";

type Props = {
  activeTab?: { path: string; dirty: boolean };
  activeLang: string;
  cursorLine: number;
  cursorCol: number;
  rootPath: string;
  branch: string;
  errorCount?: number;
  warningCount?: number;
  onOpenGit: () => void;
  onOpenProblems?: () => void;
  onOpenNotifications: () => void;
};

function Item({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const base =
    "flex items-center gap-1 px-2.5 h-full transition-colors shrink-0 " +
    "hover:bg-accent hover:text-foreground";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(base, className)}>
      {children}
    </button>
  ) : (
    <span className={cn("flex items-center gap-1 px-2.5 h-full shrink-0", className)}>
      {children}
    </span>
  );
}

function Divider() {
  return <span className="w-px h-3 bg-border/60 shrink-0" />;
}

export function StatusBar({
  activeTab,
  activeLang,
  cursorLine,
  cursorCol,
  rootPath,
  branch,
  errorCount = 0,
  warningCount = 0,
  onOpenGit,
  onOpenProblems,
  onOpenNotifications,
}: Props) {
  const { count, maxSeverity } = useNotificationCount();

  const fileName = activeTab?.path.split(/[\\/]/).pop() ?? "";

  const bellColor =
    maxSeverity === "error"
      ? "text-destructive"
      : maxSeverity === "warning"
      ? "text-amber-500"
      : undefined;

  return (
    <div className="h-6 border-t bg-muted/20 flex items-center text-[11px] text-muted-foreground shrink-0 overflow-hidden">

      {/* Left */}
      <div className="flex items-center h-full">
        {rootPath && branch && (
          <>
            <Item onClick={onOpenGit}>
              <GitBranch className="size-3" />
              <span>{branch}</span>
            </Item>
            <Divider />
          </>
        )}
        {activeTab && (
          <Item>
            <span className="truncate max-w-xs" title={activeTab.path}>
              {fileName}
            </span>
            {activeTab.dirty && (
              <span className="size-1.5 rounded-full bg-primary shrink-0" />
            )}
          </Item>
        )}
      </div>

      <div className="flex-1 min-w-0" />

      {/* Right */}
      <div className="flex items-center h-full">
        {(errorCount > 0 || warningCount > 0) && (
          <>
            <Item onClick={onOpenProblems} className="gap-2">
              {errorCount > 0 && (
                <span className="flex items-center gap-0.5 text-destructive">
                  <XCircle className="size-3" />
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-0.5 text-amber-500">
                  <AlertTriangle className="size-3" />
                  {warningCount}
                </span>
              )}
            </Item>
            <Divider />
          </>
        )}
        <LSPStatus activeLang={activeLang} />

        {activeLang && activeLang !== "plaintext" && (
          <>
            <Divider />
            <Item className="capitalize">{activeLang}</Item>
          </>
        )}

        {activeTab && (
          <>
            <Divider />
            <Item className="tabular-nums">
              Ln {cursorLine}, Col {cursorCol}
            </Item>
          </>
        )}

        <Divider />
        <Item onClick={onOpenNotifications} className={bellColor}>
          {count > 0 ? (
            <BellDot className="size-3" />
          ) : (
            <Bell className="size-3" />
          )}
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </Item>
      </div>

    </div>
  );
}
