import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
import { notifyAppearanceChanged } from "@/lib/appearance";
import { cn } from "@/lib/utils";
import { RotateCcw, X } from "lucide-react";
import { memo, useState, type KeyboardEvent } from "react";
import { EventsEmit } from "../../../../wailsjs/runtime/runtime";
import { settingActions } from "../actions";
import type { SettingDef } from "../settingsSchema";

const FILE_TREE_KEYS = new Set(["explorer.excludeFolders"]);

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === "string");
  }
  return [];
}

interface ChipsInputProps {
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

function ChipsInput({ id, values, onChange, placeholder }: ChipsInputProps) {
  const [draft, setDraft] = useState("");

  function addChip(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  }

  function removeChip(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChip(draft);
      return;
    }
    if (e.key === "Backspace" && draft === "" && values.length > 0) {
      e.preventDefault();
      removeChip(values.length - 1);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 min-h-9 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm focus-within:ring-1 focus-within:ring-ring"
      onClick={() => document.getElementById(`${id}-input`)?.focus()}
    >
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-secondary text-secondary-foreground px-2 py-0.5 text-xs"
        >
          <span className="font-mono">{v}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeChip(i);
            }}
            className="rounded-sm hover:bg-destructive/20 hover:text-destructive p-0.5 cursor-pointer transition-colors"
            aria-label={`Remover ${v}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={`${id}-input`}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) addChip(draft);
        }}
        placeholder={values.length === 0 ? placeholder : ""}
        className="flex-1 min-w-24 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
      />
    </div>
  );
}

interface SettingRowProps {
  def: SettingDef;
  highlighted?: boolean;
  onDirty?: () => void;
}

export const SettingRow = memo(SettingRowImpl);

function SettingRowImpl({ def, highlighted, onDirty }: SettingRowProps) {
  const isAction = def.type === "action";
  const { value, set, reset, loading } = useConfig<unknown>(def.key, def.defaultValue);

  function runAction() {
    if (!def.actionId) return;
    const fn = settingActions[def.actionId];
    if (!fn) {
      toast.error(`Ação "${def.actionId}" não registrada`);
      return;
    }
    try {
      fn();
    } catch (err) {
      toast.error(`Falha ao executar "${def.title}"`, err);
    }
  }

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

  const isModified = !isAction && !loading && !deepEqual(value, def.defaultValue);
  const isWideControl = def.type === "string-list";

  return (
    <div
      id={`setting-${def.key}`}
      className={cn(
        "flex items-start justify-between gap-6 py-4 px-2 -mx-2 border-b border-border/40 last:border-b-0 rounded-md transition-colors",
        highlighted && "bg-accent/60 ring-1 ring-primary/40",
      )}
    >
      <div className="flex-1 min-w-0 ">
        <div className="flex items-center gap-2">
          <label htmlFor={def.key} className="text-sm font-medium">
            {def.title}
          </label>
          {isModified && <span className="inline-block size-1.5 rounded-full bg-primary" />}
          {isModified && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              title="Restaurar padrão"
              className="size-6 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3" />
            </Button>
          )}
        </div>
        {def.description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">{def.description}</p>
        )}
        <code className="text-[10px] text-muted-foreground/70 font-mono mt-1 inline-block">
          {def.key}
        </code>
      </div>
      <div className={cn("shrink-0", isWideControl ? "w-96" : "w-64")}>
        <div className="w-full">
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
          {def.type === "slider" && (
            <SliderControl
              def={def}
              value={typeof value === "number" ? value : Number(def.defaultValue ?? 0)}
              onChange={update}
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
            />
          )}
          {def.type === "string-list" && (
            <ChipsInput
              id={def.key}
              values={toStringList(value)}
              onChange={update}
              placeholder="Digite e pressione Enter…"
            />
          )}
          {def.type === "action" && (
            <Button id={def.key} variant="outline" size="sm" onClick={runAction} className="w-full">
              {def.actionLabel ?? def.title}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderControl({
  def,
  value,
  onChange,
}: {
  def: SettingDef;
  value: number;
  onChange: (n: number) => void;
}) {
  const min = def.min ?? 0;
  const max = def.max ?? 100;
  const step = def.step ?? 1;
  const decimals = step < 1 ? Math.max(0, -Math.floor(Math.log10(step))) : 0;
  const display = value.toFixed(decimals);
  return (
    <div className="flex items-center gap-3 w-full">
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right shrink-0">
        {display}
      </span>
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
