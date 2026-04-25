import { useEffect, useState } from "react";
import { Check, Loader2, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { rpc } from "../rpc";

export function CLI() {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rpc.cli
      .isInstalled()
      .then(setInstalled)
      .catch(() => setInstalled(false));
  }, []);

  function toggle() {
    if (busy || installed === null) return;
    setBusy(true);
    const action = installed ? rpc.cli.uninstall() : rpc.cli.install();
    action
      .then(() => {
        setInstalled(!installed);
        toast.success(installed ? "CLI removida" : "CLI instalada em ~/.local/bin/adila");
      })
      .catch((err: unknown) => {
        toast.error(installed ? "Falha ao remover CLI" : "Falha ao instalar CLI", err);
      })
      .finally(() => setBusy(false));
  }

  const checked = installed === true;
  const indeterminate = installed === null;

  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/30 shadow-sm">
        <Terminal className="size-8 text-muted-foreground" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Instalar a CLI</h2>
        <p className="text-sm text-muted-foreground">
          Adicione o comando <code className="rounded bg-muted px-1 py-0.5 font-mono">adila</code>{" "}
          no seu terminal pra abrir esta IDE em qualquer pasta. Cria um link em{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">~/.local/bin/adila</code>.
        </p>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={busy || indeterminate}
        className={cn(
          "flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors",
          "hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60",
          checked && "border-primary ring-2 ring-primary/30",
        )}
        aria-pressed={checked}
      >
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border border-border transition-colors",
            checked && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : checked ? (
            <Check className="size-3.5" />
          ) : null}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            Instalar comando <span className="font-mono">adila</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {checked
              ? "Instalado — use `adila .` em qualquer terminal"
              : "Você pode desinstalar depois nas configurações"}
          </span>
        </div>
      </button>
    </div>
  );
}
