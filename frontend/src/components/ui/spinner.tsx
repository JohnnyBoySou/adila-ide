import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-3.5 animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}
