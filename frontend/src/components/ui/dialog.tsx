import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  ariaLabel,
}: DialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full max-w-xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
