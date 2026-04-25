import { useEffect, useMemo, useState } from "react";
import { Check, Code, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme, type CustomThemeConfig } from "@/hooks/useTheme";
import { CUSTOM_THEME_ID, CUSTOM_THEME_VARS } from "@/lib/themes";

const DEFAULT_DARK_VARS: Record<string, string> = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  primary: "#89b4fa",
  "primary-foreground": "#1e1e2e",
  secondary: "#313244",
  "secondary-foreground": "#cdd6f4",
  muted: "#313244",
  "muted-foreground": "#a6adc8",
  accent: "#45475a",
  "accent-foreground": "#cdd6f4",
  destructive: "#f38ba8",
  border: "#313244",
  input: "#313244",
  ring: "#89b4fa",
  card: "#181825",
  "card-foreground": "#cdd6f4",
  popover: "#181825",
  "popover-foreground": "#cdd6f4",
  sidebar: "#181825",
  "sidebar-foreground": "#cdd6f4",
  "sidebar-primary": "#89b4fa",
  "sidebar-primary-foreground": "#1e1e2e",
  "sidebar-accent": "#313244",
  "sidebar-accent-foreground": "#cdd6f4",
  "sidebar-border": "#313244",
  "sidebar-ring": "#89b4fa",
};

const DEFAULT_LIGHT_VARS: Record<string, string> = {
  background: "#ffffff",
  foreground: "#1f2328",
  primary: "#0969da",
  "primary-foreground": "#ffffff",
  secondary: "#f6f8fa",
  "secondary-foreground": "#1f2328",
  muted: "#f6f8fa",
  "muted-foreground": "#656d76",
  accent: "#eaeef2",
  "accent-foreground": "#1f2328",
  destructive: "#cf222e",
  border: "#d0d7de",
  input: "#d0d7de",
  ring: "#0969da",
  card: "#ffffff",
  "card-foreground": "#1f2328",
  popover: "#ffffff",
  "popover-foreground": "#1f2328",
  sidebar: "#f6f8fa",
  "sidebar-foreground": "#1f2328",
  "sidebar-primary": "#0969da",
  "sidebar-primary-foreground": "#ffffff",
  "sidebar-accent": "#eaeef2",
  "sidebar-accent-foreground": "#1f2328",
  "sidebar-border": "#d0d7de",
  "sidebar-ring": "#0969da",
};

function defaultsForMode(mode: "dark" | "light"): Record<string, string> {
  return mode === "light" ? DEFAULT_LIGHT_VARS : DEFAULT_DARK_VARS;
}

function groupedVars() {
  const groups: Record<string, typeof CUSTOM_THEME_VARS> = {};
  for (const v of CUSTOM_THEME_VARS) {
    if (!groups[v.group]) groups[v.group] = [];
    groups[v.group].push(v);
  }
  return Object.entries(groups);
}

function isHexColor(s: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

export function ThemeEditor() {
  const { colorTheme, setColorTheme, customTheme, setCustomTheme } = useTheme();
  const [mode, setMode] = useState<"dark" | "light">(customTheme.mode ?? "dark");
  const [vars, setVars] = useState<Record<string, string>>({
    ...defaultsForMode(customTheme.mode ?? "dark"),
    ...customTheme.vars,
  });
  const [view, setView] = useState<"form" | "json">("form");
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const isActive = colorTheme === CUSTOM_THEME_ID;

  // Re-hydrata se o config externo mudar
  useEffect(() => {
    setMode(customTheme.mode ?? "dark");
    setVars({
      ...defaultsForMode(customTheme.mode ?? "dark"),
      ...customTheme.vars,
    });
  }, [customTheme]);

  // Mantém JSON em sync quando vai para a aba JSON
  useEffect(() => {
    if (view === "json") {
      setJsonDraft(JSON.stringify({ mode, vars }, null, 2));
      setJsonError(null);
    }
  }, [view, mode, vars]);

  function persist(next: CustomThemeConfig) {
    void setCustomTheme(next);
  }

  function updateVar(key: string, value: string) {
    const next = { ...vars, [key]: value };
    setVars(next);
    persist({ mode, vars: next });
  }

  function updateMode(next: "dark" | "light") {
    setMode(next);
    // Quando troca o modo, mescla os defaults do novo modo com customs definidos
    const merged = { ...defaultsForMode(next), ...vars };
    setVars(merged);
    persist({ mode: next, vars: merged });
  }

  function activate() {
    void setColorTheme(CUSTOM_THEME_ID);
  }

  function resetAll() {
    const merged = defaultsForMode(mode);
    setVars(merged);
    persist({ mode, vars: merged });
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonDraft);
      if (!parsed || typeof parsed !== "object") throw new Error("JSON deve ser um objeto");
      const nextMode: "dark" | "light" = parsed.mode === "light" ? "light" : "dark";
      const nextVars: Record<string, string> = {};
      const v = parsed.vars && typeof parsed.vars === "object" ? parsed.vars : {};
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === "string") nextVars[k] = val;
      }
      const merged = { ...defaultsForMode(nextMode), ...nextVars };
      setMode(nextMode);
      setVars(merged);
      persist({ mode: nextMode, vars: merged });
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "JSON inválido");
    }
  }

  const groups = useMemo(() => groupedVars(), []);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-5 text-primary" />
            Editor de tema
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Personalize as variáveis CSS do tema. As mudanças são aplicadas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setView("form")}
              className={
                "rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                (view === "form" ? "bg-background shadow-sm" : "text-muted-foreground")
              }
            >
              Variáveis
            </button>
            <button
              type="button"
              onClick={() => setView("json")}
              className={
                "rounded px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors " +
                (view === "json" ? "bg-background shadow-sm" : "text-muted-foreground")
              }
            >
              <Code className="size-3" /> JSON
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="size-3.5" /> Resetar
          </Button>
          {isActive ? (
            <Button size="sm" disabled>
              <Check className="size-3.5" /> Tema ativo
            </Button>
          ) : (
            <Button size="sm" onClick={activate}>
              Ativar tema
            </Button>
          )}
        </div>
      </header>

      <div className="flex items-center gap-3 border-b px-6 py-3">
        <span className="text-xs font-medium text-muted-foreground">Modo:</span>
        <div className="flex rounded-md border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => updateMode("dark")}
            className={
              "rounded px-3 py-1 text-xs font-medium transition-colors " +
              (mode === "dark" ? "bg-background shadow-sm" : "text-muted-foreground")
            }
          >
            Escuro
          </button>
          <button
            type="button"
            onClick={() => updateMode("light")}
            className={
              "rounded px-3 py-1 text-xs font-medium transition-colors " +
              (mode === "light" ? "bg-background shadow-sm" : "text-muted-foreground")
            }
          >
            Claro
          </button>
        </div>
        {!isActive && (
          <span className="ml-auto text-xs text-muted-foreground">
            Ative o tema para ver as mudanças aplicadas em toda a IDE.
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {view === "form" ? (
          <div className="px-6 py-5 space-y-6">
            {groups.map(([groupName, items]) => (
              <section key={groupName}>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {groupName}
                </h2>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((v) => (
                    <VarRow
                      key={v.key}
                      label={v.label}
                      varKey={v.key}
                      value={vars[v.key] ?? ""}
                      onChange={(val) => updateVar(v.key, val)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="px-6 py-5 flex flex-col gap-3">
            <Textarea
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              spellCheck={false}
              className="font-mono text-xs min-h-[60vh] p-3"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={applyJson}>
                Aplicar JSON
              </Button>
              {jsonError && <span className="text-xs text-destructive">{jsonError}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VarRow({
  label,
  varKey,
  value,
  onChange,
}: {
  label: string;
  varKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const swatchColor = value || "transparent";
  const canPick = isHexColor(value || "");

  return (
    <div className="flex items-center gap-2 rounded-md border bg-card/50 p-2">
      <input
        type="color"
        value={canPick ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
        title={canPick ? "Selecionar cor" : "Use formato hex (#rrggbb) para usar o color picker"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1">
          <span
            className="size-3 shrink-0 rounded-sm border border-border/60"
            style={{ background: swatchColor }}
            aria-hidden
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft !== value) onChange(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (draft !== value) onChange(draft);
                (e.target as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
            className="h-6 w-full rounded border bg-input/30 px-1.5 text-[11px] font-mono outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50"
            placeholder="#1e1e2e | oklch(...) | rgb(...)"
            title={`--${varKey}`}
          />
        </div>
      </div>
    </div>
  );
}
