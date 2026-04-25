import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ComponentType<LucideProps>;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-6 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <div className="text-xs text-muted-foreground max-w-sm">
            {description}
          </div>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
