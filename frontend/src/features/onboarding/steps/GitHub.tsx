import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { call } from "@/rpc/core";
import { rpc } from "@/features/git/rpc";
import { GithubIcon } from "@/features/git/GithubIcon";
import type { DeviceFlowStart, GitHubUser } from "@/features/git/types";

export function GitHub() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [device, setDevice] = useState<DeviceFlowStart | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    rpc.github
      .isAuthenticated()
      .then((auth) => {
        if (!auth) return;
        rpc.github
          .getUser()
          .then(setUser)
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      rpc.github.cancelDeviceFlow().catch(() => {});
    };
  }, []);

  const start = useCallback(async () => {
    if (starting || polling) return;
    setStarting(true);
    try {
      const d = await rpc.github.startDeviceFlow();
      setDevice(d);
      setPolling(true);
      const verifyUrl = `${d.verificationUri}?user_code=${encodeURIComponent(d.userCode)}`;
      call("shell.openUrl", { url: verifyUrl }).catch(() => {});
      try {
        await rpc.github.pollDeviceToken(d.deviceCode, d.interval);
        const u = await rpc.github.getUser();
        setUser(u);
        setDevice(null);
        toast.success(`Conectado como @${u.login}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/cancelado/i.test(msg)) {
          toast.error("Falha na autenticação", err);
        }
        setDevice(null);
      } finally {
        setPolling(false);
      }
    } catch (err: unknown) {
      toast.error("Não foi possível iniciar o login", err);
    } finally {
      setStarting(false);
    }
  }, [starting, polling]);

  const copyCode = useCallback(() => {
    if (!device) return;
    navigator.clipboard.writeText(device.userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [device]);

  const reopenBrowser = useCallback(() => {
    if (!device) return;
    const url = `${device.verificationUri}?user_code=${encodeURIComponent(device.userCode)}`;
    call("shell.openUrl", { url }).catch(() => {});
  }, [device]);

  const logout = useCallback(() => {
    rpc.github
      .logout()
      .then(() => {
        setUser(null);
        toast.success("Desconectado do GitHub");
      })
      .catch((err: unknown) => toast.error("Erro ao desconectar", err));
  }, []);

  const checked = user !== null;

  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/30 shadow-sm">
        <GithubIcon className="size-8 text-muted-foreground" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Conectar ao GitHub</h2>
        <p className="text-sm text-muted-foreground">
          Necessário pra publicar repositórios e branches direto da IDE. O Adila não vê sua senha —
          recebemos só um token com permissão{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">repo</code>.
        </p>
      </div>

      {device ? (
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 text-left">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            Seu código
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 select-all rounded-md bg-background px-3 py-2 font-mono text-base tracking-[0.3em]">
              {device.userCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              title="Copiar"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Abrimos {device.verificationUri} no seu navegador. Confirme o código e clique em
            "Authorize".
          </p>
          <div className="flex items-center gap-2">
            {polling && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Aguardando…
              </span>
            )}
            <button
              type="button"
              onClick={reopenBrowser}
              className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="size-3" /> Reabrir GitHub
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={checked ? logout : start}
          disabled={starting}
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
            {starting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : checked ? (
              <Check className="size-3.5" />
            ) : null}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium">
              {checked ? `Conectado como @${user?.login}` : "Conectar conta do GitHub"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {checked
                ? "Clique para desconectar"
                : "Abre o navegador para autorizar via Device Flow"}
            </span>
          </div>
          {checked && user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.login} className="size-8 rounded-full" />
          ) : null}
        </button>
      )}
    </div>
  );
}
