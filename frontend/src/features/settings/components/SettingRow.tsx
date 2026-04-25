import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useConfig } from "@/hooks/useConfig";
import { toast } from "@/hooks/useToast";
import { ACCENT_PRESETS, notifyAppearanceChanged } from "@/lib/appearance";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { memo } from "react";
import { EventsEmit } from "../../../../wailsjs/runtime/runtime";
import type { SettingDef } from "../settingsSchema";

const FILE_TREE_KEYS = new Set(["explorer.excludeFolders"]);

function parseStringList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stringifyList(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === "string").join(", ");
  }
  return "";
}

interface SettingRowProps {
  def: SettingDef;
  highlighted?: boolean;
  onDirty?: () => void;
}

export const SettingRow = memo(SettingRowImpl);

function SettingRowImpl({ def, highlighted, onDirty }: SettingRowProps) {
  const { value, set, reset, loading } = useConfig<unknown>(def.key, def.defaultValue);

  function update(next: unknown) {
    set(next)
      .then(() => {
        notifyAppearanceChanged(def.key);
        if (FILE_TREE_KEYS.has(def.key)) {
          EventsEmit("fileTree.changed");
        }
        onDirty?.();
      })
      .catch((err: unknown) => {
        toast.error(`Não foi possível salvar "${def.title}"`, err);
      });
  }

  function handleReset() {
    reset()
      .then(() => {
        notifyAppearanceChanged(def.key);
      })
      .catch((err: unknown) => {
        toast.error(`Não foi possível restaurar "${def.title}"`, err);
      });
  }

  const isModified = !loading && !deepEqual(value, def.defaultValue);

  return (
    <div
      id={`setting-${def.key}`}
      className={cn(
        "flex items-start gap-6 py-4 px-2 -mx-2 border-b border-border/40 last:border-b-0 rounded-md transition-colors",
        highlighted && "bg-accent/60 ring-1 ring-primary/40",
      )}
    >
      <div className="flex-1 min-w-0 ">
        <div className="flex items-center gap-2">
          <label htmlFor={def.key} className="text-sm font-medium">
            {def.title}
          </label>
          {isModified && <span className="inline-block size-1.5 rounded-full bg-primary" />}
        </div>
        {def.description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">{def.description}</p>
        )}
        <code className="text-[10px] text-muted-foreground/70 font-mono mt-1 inline-block">
          {def.key}
        </code>
      </div>
      <div className="flex items-center gap-2 w-64 shrink-0">
        <div className="flex-1">
          {def.type === "boolean" && (
            <Switch id={def.key} checked={Boolean(value)} onCheckedChange={update} />
          )}
          {def.type === "string" && (
            <Input
              id={def.key}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => update(e.target.value)}
            />
          )}
          {def.type === "number" && (
            <Input
              id={def.key}
              type="number"
              value={typeof value === "number" ? value : ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                update(Number.isFinite(n) ? n : def.defaultValue);
              }}
            />
          )}
          {def.type === "enum" && def.options && (
            <Select
              value={typeof value === "string" ? value : String(value ?? "")}
              onValueChange={update}
            >
              <SelectTrigger id={def.key} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {def.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {def.type === "color" && (
            <ColorPicker
              id={def.key}
              value={typeof value === "string" ? value : String(def.defaultValue)}
              onChange={update}
              presets={ACCENT_PRESETS}
            />
          )}
          {def.type === "string-list" && (
            <Input
              id={def.key}
              value={stringifyList(value)}
              placeholder="node_modules, dist, build"
              onChange={(e) => update(parseStringList(e.target.value))}
            />
          )}
        </div>
        {isModified && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            title="Restaurar padrão"
            className="size-8"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}
