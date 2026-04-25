import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function Select({
  className,
  value,
  onValueChange,
  options,
  ...props
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        "flex h-9 w-full appearance-none rounded-md border border-border bg-input/30 px-3 py-1 pr-8 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%221.5%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1em]",
        className,
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-popover">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
