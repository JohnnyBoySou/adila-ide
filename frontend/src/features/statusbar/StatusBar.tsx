import { AlertTriangle, Bell, BellDot, GitBranch, XCircle } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { FpsMeter } from "@/components/FpsMeter";
import { LSPStatus } from "@/features/editor/LSPStatus";
import { IndexerStatus } from "@/features/indexer/IndexerStatus";
import { useMarkersStore } from "@/stores/markersStore";
import { useUiStore } from "@/stores/uiStore";
import { useNotificationCount } from "./useNotificationCount";

type Props = {
  activeTab?: { path: string; dirty: boolean };
  activeLang: string;
  rootPath: string;
  showFps?: boolean;
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

// Lê só o branch — re-renderiza isolado quando o git emite mudança.
const BranchItem = memo(function BranchItem({ onOpenGit }: { onOpenGit: () => void }) {
  const branch = useUiStore((s) => s.branch);
  if (!branch) return null;
  return (
    <>
      <Item onClick={onOpenGit}>
        <GitBranch className="size-3" />
        <span>{branch}</span>
      </Item>
      <Divider />
    </>
  );
});

// Lê só linha/coluna — re-renderiza isolado a cada movimento de caret.
const CursorItem = memo(function CursorItem() {
  const cursorLine = useUiStore((s) => s.cursorLine);
  const cursorCol = useUiStore((s) => s.cursorCol);
  return (
    <Item className="tabular-nums">
      Ln {cursorLine}, Col {cursorCol}
    </Item>
  );
});

// Lê só counts de markers — re-renderiza isolado quando LSP atualiza diagnósticos.
const ProblemsItem = memo(function ProblemsItem({ onOpen }: { onOpen?: () => void }) {
  const errorCount = useMarkersStore((s) => s.errorCount);
  const warningCount = useMarkersStore((s) => s.warningCount);
  if (errorCount === 0 && warningCount === 0) return null;
  return (
    <>
      <Item onClick={onOpen} className="gap-2">
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
  );
});

export const StatusBar = memo(function StatusBar({
  activeTab,
  activeLang,
  rootPath,
  showFps,
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
        {rootPath && <BranchItem onOpenGit={onOpenGit} />}
        {activeTab && (
          <Item>
            <span className="truncate max-w-xs" title={activeTab.path}>
              {fileName}
            </span>
            {activeTab.dirty && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
          </Item>
        )}
      </div>

      <div className="flex-1 min-w-0" />

      {/* Right */}
      <div className="flex items-center h-full">
        <ProblemsItem onOpen={onOpenProblems} />
        <IndexerStatus />
        <Divider />
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
            <CursorItem />
          </>
        )}

        {showFps && (
          <>
            <Divider />
            <FpsMeter />
          </>
        )}

        <Divider />
        <Item onClick={onOpenNotifications} className={bellColor}>
          {count > 0 ? <BellDot className="size-3" /> : <Bell className="size-3" />}
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </Item>
      </div>
    </div>
  );
});
