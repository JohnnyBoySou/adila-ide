import { Allotment } from "allotment";
import "allotment/dist/style.css";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper sobre allotment (port React do split view do VS Code).
 *
 * Por que trocamos: react-resizable-panels rerenderizava o grupo inteiro a
 * cada tick de mousemove durante drag (78% do tempo de render no profile).
 * Allotment manipula DOM direto durante drag e só dispara onChange ao soltar.
 *
 * `ResizablePanel` é re-export direto de `Allotment.Pane` — Allotment usa
 * `Children.toArray` e identifica panes pela referência do componente, então
 * wrappers customizados não seriam reconhecidos.
 *
 * `ResizableHandle` virou no-op: Allotment renderiza separators automáticos
 * entre panes. Mantido para minimizar churn nos callsites.
 */
type GroupProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
  onLayoutChanged?: (sizes: number[]) => void;
  proportionalLayout?: boolean;
  children: ReactNode;
};

export function ResizablePanelGroup({
  orientation,
  className,
  onLayoutChanged,
  proportionalLayout = true,
  children,
}: GroupProps) {
  return (
    <div className={cn("relative h-full w-full", className)}>
      <Allotment
        vertical={orientation === "vertical"}
        onChange={onLayoutChanged}
        proportionalLayout={proportionalLayout}
      >
        {children}
      </Allotment>
    </div>
  );
}

export const ResizablePanel = Allotment.Pane;

export function ResizableHandle(_: { withHandle?: boolean; className?: string }) {
  return null;
}
