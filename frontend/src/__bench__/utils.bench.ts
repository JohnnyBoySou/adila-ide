import { bench, describe } from "vitest";
import { cn } from "../lib/utils";

// `cn` é chamado em quase todo render — o custo amortizado importa.
describe("utils — cn (twMerge + clsx)", () => {
  bench("simple 2 strings", () => {
    cn("flex items-center", "gap-2");
  });

  bench("with conditional", () => {
    const active = true;
    cn("flex", active && "bg-accent", "text-foreground");
  });

  bench("typical button (8 classes)", () => {
    cn(
      "inline-flex items-center justify-center rounded-md text-sm font-medium",
      "bg-primary text-primary-foreground",
      "hover:bg-primary/90 disabled:opacity-50",
    );
  });

  bench("with conflicts (twMerge resolves)", () => {
    cn("p-2 px-4", "p-3");
  });

  bench("nested array + object", () => {
    cn("flex", ["gap-2", "items-center"], { "bg-accent": true, hidden: false });
  });

  bench("stress (20 args, mixed)", () => {
    cn(
      "flex",
      "items-center",
      "justify-between",
      "rounded-md",
      "border",
      "px-3",
      "py-2",
      "text-sm",
      "font-medium",
      "transition-colors",
      { "bg-accent": true },
      { "text-foreground": true },
      ["hover:bg-accent/80"],
      "focus-visible:ring-2",
      "focus-visible:ring-ring",
      "disabled:opacity-50",
      "disabled:pointer-events-none",
      "data-[state=open]:bg-accent",
      "data-[state=on]:bg-primary",
      "shadow-xs",
    );
  });
});
