import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast, useToasts, type ToastVariant } from "@/hooks/useToast";

const iconByVariant: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

const toneByVariant: Record<ToastVariant, string> = {
  default: "border-border text-foreground",
  success: "border-primary/40 text-foreground",
  error: "border-destructive/60 text-foreground",
};

const iconToneByVariant: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-primary",
  error: "text-destructive",
};

export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = iconByVariant[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-80 items-start gap-3 rounded-md border bg-popover px-4 py-3 shadow-lg",
              toneByVariant[t.variant],
            )}
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", iconToneByVariant[t.variant])} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-xs text-muted-foreground break-words">
                  {t.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              aria-label="Fechar"
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
