import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

interface SpinnerProps {
  className?: string;
  label?: string;
  size?: SpinnerSize;
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
};

export function Spinner({ className, label, size = "sm" }: SpinnerProps) {
  const iconCls = sizeMap[size];

  // Sem label: render do ícone puro pra fluir inline (botões, status bar etc).
  if (!label) {
    return (
      <Loader2
        role="status"
        aria-label="Carregando"
        className={cn(iconCls, "animate-spin", className)}
      />
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}
    >
      <Loader2 className={cn(iconCls, "animate-spin")} />
      <span>{label}</span>
    </div>
  );
}
