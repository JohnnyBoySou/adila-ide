import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Algo deu errado",
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-3 p-6 text-center", className)}
    >
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-destructive/80 max-w-sm break-words">{message}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
