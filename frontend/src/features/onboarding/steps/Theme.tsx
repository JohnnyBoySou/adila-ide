import { Check, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/hooks/useConfig";
import { toast } from "@/hooks/useToast";
import { THEMES } from "@/lib/themes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuickId = "dark" | "light";

const quickThemes: Array<{
  id: QuickId;
  name: string;
  description: string;
  icon: typeof Moon;
  vscodeTheme: string;
}> = [
  {
    id: "dark",
    name: "Escuro",
    description: "Padrão para longas sessões",
    icon: Moon,
    vscodeTheme: "Default Dark Modern",
  },
  {
    id: "light",
    name: "Claro",
    description: "Melhor contraste com luz ambiente",
    icon: Sun,
    vscodeTheme: "Default Light Modern",
  },
];

const allThemes = THEMES.filter((t) => t.id !== "Custom");

export function Theme() {
  const { value: current, set } = useConfig<string>("workbench.colorTheme", "Default Dark Modern");

  const isQuick = quickThemes.some((q) => q.vscodeTheme === current);

  function apply(themeId: string, label?: string) {
    set(themeId).catch((err: unknown) => {
      toast.error(`Não foi possível aplicar o tema ${label ?? themeId}`, err);
    });
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div className="w-full overflow-hidden rounded-xl border border-border/50 shadow-sm bg-muted/30">
        <img
          src="/onboarding_2.png"
          alt="Temas do Adila IDE"
          className="w-full object-cover max-h-56"
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Escolha um tema</h2>
        <p className="text-sm text-muted-foreground">
          Você pode trocar a qualquer momento nas configurações.
        </p>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {quickThemes.map((t) => {
          const Icon = t.icon;
          const isActive = current === t.vscodeTheme;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => apply(t.vscodeTheme, t.name)}
              className={cn(
                "relative flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50",
                isActive && "border-primary ring-2 ring-primary/30",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className="size-5 text-muted-foreground" />
                {isActive && <Check className="size-4 text-primary" />}
              </div>
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="w-full max-w-sm space-y-2 text-left">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Ou escolha outro tema
        </label>
        <Select
          value={isQuick ? "" : current}
          onValueChange={(v) => {
            const t = allThemes.find((x) => x.id === v);
            apply(v, t?.label);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Ver todos os temas…" />
          </SelectTrigger>
          <SelectContent>
            {allThemes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
