import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Info, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { rpc } from "../rpc";
import type { NotificationItem, Severity } from "../types";

const TOAST_AUTO_DISMISS_MS = 8000;

const ICON_BY_SEVERITY: Record<Severity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const STRIP_TONE_BY_SEVERITY: Record<Severity, string> = {
  info: "bg-primary/70",
  warning: "bg-yellow-500",
  error: "bg-destructive",
};

const ICON_BG_BY_SEVERITY: Record<Severity, string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  error: "bg-destructive/10 text-destructive",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Info",
  warning: "Aviso",
  error: "Erro",
};

interface ToastProps {
  item: NotificationItem;
  inCenter?: boolean;
}

export function Toast({ item, inCenter = false }: ToastProps) {
  const Icon = ICON_BY_SEVERITY[item.severity];
  const hasActions = item.primaryActions.length > 0 || item.secondaryActions.length > 0;
  const showActions = item.expanded && hasActions;

  // Non-sticky toasts auto-dismiss after a fixed delay — but only on the
  // floating surface. In the center, items stay until the user clears them.
  useEffect(() => {
    if (inCenter || item.sticky) {
      return;
    }
    const t = setTimeout(() => {
      void rpc.close(item.id);
    }, TOAST_AUTO_DISMISS_MS);
    return () => {
      clearTimeout(t);
    };
  }, [item.id, item.sticky, inCenter]);

  return (
    <div
      role={item.severity === "error" ? "alert" : "status"}
      className={cn(
        "group relative flex w-full overflow-hidden rounded-lg border border-border/80 bg-popover text-popover-foreground",
        "shadow-sm transition-all duration-150",
        "hover:border-border hover:shadow-md",
        !inCenter && "pointer-events-auto w-[420px]",
      )}
    >
      {/* Severity strip on the leading edge — subtle but unmistakable. */}
      <div aria-hidden className={cn("w-1 shrink-0", STRIP_TONE_BY_SEVERITY[item.severity])} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-3 px-3.5 py-3">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              ICON_BG_BY_SEVERITY[item.severity],
            )}
          >
            <Icon className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <span
                className={cn(
                  "rounded-sm px-1 py-px",
                  item.severity === "error" && "text-destructive",
                  item.severity === "warning" && "text-yellow-600 dark:text-yellow-400",
                )}
              >
                {SEVERITY_LABEL[item.severity]}
              </span>
              {item.source && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="flex min-w-0 items-center gap-1 normal-case tracking-normal">
                    <Tag className="size-2.5 opacity-70" />
                    <span className="truncate">{item.source}</span>
                  </span>
                </>
              )}
              {item.sticky && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="rounded-sm bg-muted px-1 text-muted-foreground">fixo</span>
                </>
              )}
            </div>

            <div className="text-[13px] leading-relaxed text-foreground break-words">
              {item.message}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
            {hasActions && (
              <button
                type="button"
                onClick={() => {
                  void rpc.toggleExpand(item.id);
                }}
                aria-label={item.expanded ? "Recolher" : "Expandir"}
                className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.expanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void rpc.close(item.id);
              }}
              aria-label="Fechar"
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {showActions && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-3.5 py-2">
            {item.secondaryActions.map((a) => (
              <button
                key={`s-${a.index}`}
                type="button"
                disabled={!a.enabled}
                onClick={() => {
                  void rpc.runAction(item.id, "secondary", a.index);
                }}
                className="rounded-sm px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
            {item.primaryActions.map((a) => (
              <button
                key={`p-${a.index}`}
                type="button"
                disabled={!a.enabled}
                onClick={() => {
                  void rpc.runAction(item.id, "primary", a.index);
                }}
                className="rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {item.progress && <ProgressBar progress={item.progress} />}
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: NonNullable<NotificationItem["progress"]> }) {
  if (progress.done) {
    return null;
  }
  if (progress.infinite) {
    return (
      <div className="h-0.5 overflow-hidden bg-border/60">
        <div className="h-full w-1/3 animate-pulse bg-primary" />
      </div>
    );
  }
  if (typeof progress.total === "number" && typeof progress.worked === "number") {
    const pct = Math.min(100, Math.max(0, (progress.worked / progress.total) * 100));
    return (
      <div className="h-0.5 bg-border/60">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    );
  }
  return null;
}

// Toast track for the bottom-right surface — caps visible toasts and stacks the rest.
interface ToastListProps {
  items: NotificationItem[];
  max?: number;
}

const DEFAULT_MAX_VISIBLE = 3;

export function ToastList({ items, max = DEFAULT_MAX_VISIBLE }: ToastListProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const visible = items.slice(0, max);
  const hidden = items.slice(max);
  return (
    <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2">
      {hidden.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setOverflowOpen((v) => !v);
          }}
          className="pointer-events-auto rounded-full bg-popover/90 px-3 py-1 text-xs text-muted-foreground shadow-md hover:text-foreground"
        >
          {overflowOpen ? "Esconder" : `+${hidden.length} mais`}
        </button>
      )}
      {overflowOpen && hidden.map((item) => <Toast key={item.id} item={item} />).reverse()}
      {visible.map((item) => <Toast key={item.id} item={item} />).reverse()}
    </div>
  );
}
