import { Check, Sparkles } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { THEMES } from "@/lib/themes";
import { Dialog } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenEditor?: () => void;
};

export function ThemePicker({ open, onClose, onOpenEditor }: Props) {
  const { colorTheme, setColorTheme } = useTheme();

  const dark = THEMES.filter((t) => t.mode === "dark");
  const light = THEMES.filter((t) => t.mode === "light");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      ariaLabel="Selecionar tema"
      className="w-96 max-h-[75vh] flex flex-col overflow-hidden"
    >
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-b">
        Selecionar tema de cor — Ctrl+K Ctrl+T
      </div>

      <div className="overflow-y-auto scrollbar py-1">
        <Section
          title="Escuros"
          themes={dark}
          active={colorTheme}
          onPick={(id) => {
            void setColorTheme(id);
            onClose();
          }}
        />
        <Section
          title="Claros"
          themes={light}
          active={colorTheme}
          onPick={(id) => {
            void setColorTheme(id);
            onClose();
          }}
        />
      </div>

      {onOpenEditor && (
        <button
          type="button"
          onClick={() => {
            onOpenEditor();
            onClose();
          }}
          className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Editar tema personalizado…
        </button>
      )}
    </Dialog>
  );
}

function Section({
  title,
  themes,
  active,
  onPick,
}: {
  title: string;
  themes: typeof THEMES;
  active: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </div>
      {themes.map((theme) => {
        const isActive = active === theme.id;
        return (
          <button
            key={theme.id}
            onClick={() => onPick(theme.id)}
            className={
              "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors hover:bg-accent " +
              (isActive ? "bg-accent/60" : "")
            }
          >
            <div
              className="size-6 rounded border shrink-0 flex items-center justify-center overflow-hidden"
              style={{
                background: theme.preview.bg,
                borderColor: theme.preview.border,
              }}
            >
              <div className="size-3 rounded-full" style={{ background: theme.preview.accent }} />
            </div>

            <span className="flex-1 text-sm" style={{ color: undefined }}>
              {theme.label}
            </span>

            {isActive && <Check className="size-3.5 text-primary shrink-0" />}
          </button>
        );
      })}
    </>
  );
}
