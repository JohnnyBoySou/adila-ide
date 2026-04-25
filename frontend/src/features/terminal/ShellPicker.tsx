import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Star } from "lucide-react";
import { GetDefaultShell, ListShells, SetDefaultShell } from "../../../wailsjs/go/main/Terminal";

type ShellInfo = {
  path: string;
  name: string;
  avail: boolean;
};

type ShellPickerProps = {
  onPick: (shell: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

export function ShellPicker({ onPick, onClose, anchorRef }: ShellPickerProps) {
  const [shells, setShells] = useState<ShellInfo[]>([]);
  const [defaultShell, setDefaultShell] = useState("");
  const [loading, setLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([ListShells(), GetDefaultShell()])
      .then(([list, def]) => {
        setShells(list ?? []);
        setDefaultShell(def);
      })
      .finally(() => setLoading(false));
  }, []);

  // posiciona o menu acima do anchor
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({
      bottom: window.innerHeight - rect.top + 4,
      left: rect.left,
    });
  }, [anchorRef]);

  // fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const tid = setTimeout(() => window.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(tid);
      window.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  const handleSetDefault = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await SetDefaultShell(path).catch(() => {});
    setDefaultShell(path);
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[220px] text-xs"
      style={{ bottom: pos.bottom, left: pos.left }}
    >
      <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Novo terminal
      </div>

      {loading ? (
        <div className="px-3 py-2 text-muted-foreground">Carregando…</div>
      ) : shells.length === 0 ? (
        <div className="px-3 py-2 text-muted-foreground">Nenhum shell encontrado</div>
      ) : (
        shells.map((s) => {
          const isDefault = s.path === defaultShell;
          return (
            <button
              key={s.path}
              onClick={() => {
                onPick(s.path);
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground text-left group"
            >
              {/* indicador de default */}
              <span className="w-3 shrink-0">
                {isDefault && <Check className="size-3 text-primary" />}
              </span>

              <span className="flex-1 min-w-0">
                <span className="font-medium">{s.name}</span>
                <span className="block text-[10px] text-muted-foreground truncate">{s.path}</span>
              </span>

              {/* botão de definir padrão */}
              <button
                onClick={(e) => handleSetDefault(e, s.path)}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded"
                title="Definir como padrão"
              >
                <Star className={`size-3 ${isDefault ? "fill-primary text-primary" : ""}`} />
              </button>

              <ChevronRight className="size-3 opacity-30 shrink-0" />
            </button>
          );
        })
      )}

      <div className="border-t mt-1 pt-1">
        <button
          onClick={() => {
            onPick("");
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground text-left"
        >
          <span className="w-3 shrink-0" />
          <span className="text-muted-foreground">Shell padrão do sistema</span>
        </button>
      </div>
    </div>
  );
}
