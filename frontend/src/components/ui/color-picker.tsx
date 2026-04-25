import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  presets?: { value: string; label: string }[];
}

export function ColorPicker({ id, value, onChange, presets = [] }: ColorPickerProps) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(next: string) {
    if (/^#[0-9a-f]{6}$/i.test(next.trim())) {
      onChange(next.trim().toLowerCase());
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const selected = p.value.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={p.value}
              type="button"
              title={p.label}
              aria-label={p.label}
              onClick={() => {
                onChange(p.value);
              }}
              className={cn(
                "size-6 rounded-full border border-border/60 transition-transform",
                selected &&
                  "scale-110 ring-2 ring-offset-2 ring-offset-background ring-foreground/40",
                "hover:scale-110",
              )}
              style={{ backgroundColor: p.value }}
            >
              {selected && <Check className="size-3 mx-auto text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className="size-8 cursor-pointer rounded-md border border-border bg-transparent"
        />
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onBlur={() => {
            commit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit(draft);
              (e.target as HTMLInputElement).blur();
            }
          }}
          spellCheck={false}
          className="h-8 w-24 rounded-md border border-border bg-input/30 px-2 text-xs font-mono uppercase outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>
    </div>
  );
}
