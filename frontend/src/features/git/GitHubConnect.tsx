import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, LogOut } from "lucide-react";
import { GithubIcon } from "./GithubIcon";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/useToast";
import { call } from "@/rpc/core";
import { rpc } from "./rpc";
import type { DeviceFlowStart, GitHubUser } from "./types";

interface GitHubConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated?: (user: GitHubUser) => void;
}

export function GitHubConnect({ open, onOpenChange, onAuthenticated }: GitHubConnectProps) {
  const [device, setDevice] = useState<DeviceFlowStart | null>(null);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = useCallback(() => {
    setDevice(null);
    setStarting(false);
    setPolling(false);
    setCopied(false);
  }, []);

  useEffect(() => {
    if (!open) {
      // Cancela polling se o modal foi fechado durante a espera.
      rpc.github.cancelDeviceFlow().catch(() => {});
      reset();
    }
  }, [open, reset]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const d = await rpc.github.startDeviceFlow();
      setDevice(d);
      setPolling(true);
      // Abre o browser automaticamente com o user_code pré-preenchido para que
      // o usuário só precise clicar em "Authorize".
      const verifyUrl = `${d.verificationUri}?user_code=${encodeURIComponent(d.userCode)}`;
      call("shell.openUrl", { url: verifyUrl }).catch(() => {});
      try {
        await rpc.github.pollDeviceToken(d.deviceCode, d.interval);
        const user = await rpc.github.getUser();
        toast.success(`Conectado como @${user.login}`);
        onAuthenticated?.(user);
        onOpenChange(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/cancelado/i.test(msg)) {
          toast.error("Falha na autenticação", err);
        }
      } finally {
        setPolling(false);
      }
    } catch (err: unknown) {
      toast.error("Não foi possível iniciar o login", err);
    } finally {
      setStarting(false);
    }
  }, [onAuthenticated, onOpenChange]);

  const copyCode = useCallback(() => {
    if (!device) return;
    navigator.clipboard.writeText(device.userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [device]);

  const openVerification = useCallback(() => {
    if (!device) return;
    const url = `${device.verificationUri}?user_code=${encodeURIComponent(device.userCode)}`;
    call("shell.openUrl", { url }).catch(() => {});
  }, [device]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Conectar ao GitHub">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <GithubIcon className="size-6" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">Conectar ao GitHub</h2>
            <p className="text-xs text-muted-foreground">
              Necessário para publicar repositórios e branches no seu perfil.
            </p>
          </div>
        </div>

        {!device ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Vamos abrir o GitHub no seu navegador e pedir um código de autorização.
              O Adila IDE não vê sua senha — apenas recebe um token com permissão{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">repo</code>.
            </p>
            <Button onClick={start} disabled={starting} className="gap-2">
              {starting ? <Spinner size="md" /> : <GithubIcon className="size-4" />}
              Iniciar autenticação
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-border/60 bg-muted/30 p-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Seu código
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded-md bg-background px-3 py-2 font-mono text-lg tracking-[0.3em]">
                  {device.userCode}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  title="Copiar código"
                  className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                </button>
              </div>
            </div>

            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  1
                </span>
                <span>
                  Abrimos{" "}
                  <button
                    type="button"
                    onClick={openVerification}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {device.verificationUri}
                    <ExternalLink className="size-3" />
                  </button>{" "}
                  no seu navegador com o código já preenchido.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  2
                </span>
                <span>Confirme o código e clique em "Authorize Adila IDE".</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                  3
                </span>
                <span className="flex items-center gap-2">
                  Voltaremos automaticamente quando você concluir.
                  {polling && <Spinner />}
                </span>
              </li>
            </ol>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="outline" onClick={openVerification} className="gap-2">
                <ExternalLink className="size-4" />
                Abrir GitHub
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

interface GitHubAccountBadgeProps {
  user: GitHubUser;
  onLogout: () => void;
}

export function GitHubAccountBadge({ user, onLogout }: GitHubAccountBadgeProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-xs">
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.login} className="size-5 rounded-full" />
      ) : (
        <GithubIcon className="size-4" />
      )}
      <span className="font-medium">@{user.login}</span>
      <button
        type="button"
        onClick={onLogout}
        title="Desconectar"
        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
      >
        <LogOut className="size-3" />
      </button>
    </div>
  );
}

interface PublishRepoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onPublished?: (htmlUrl: string) => void;
}

export function PublishRepoDialog({
  open,
  onOpenChange,
  defaultName,
  onPublished,
}: PublishRepoDialogProps) {
  const [name, setName] = useState(defaultName ?? "");
  const [isPrivate, setIsPrivate] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName ?? "");
      setIsPrivate(true);
    }
  }, [open, defaultName]);

  const submit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPublishing(true);
    try {
      const repo = await rpc.github.createAndPublish(trimmed, isPrivate);
      toast.success(`Publicado em ${repo.htmlUrl}`);
      onPublished?.(repo.htmlUrl);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error("Erro ao publicar repositório", err);
    } finally {
      setPublishing(false);
    }
  }, [name, isPrivate, onOpenChange, onPublished]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Publicar no GitHub">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-3">
          <GithubIcon className="size-6" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">Publicar no GitHub</h2>
            <p className="text-xs text-muted-foreground">
              Cria um novo repositório no seu perfil e envia esta pasta.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="repo-name" className="text-xs font-medium">
            Nome do repositório
          </label>
          <input
            id="repo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !publishing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="meu-projeto"
            autoFocus
            className="rounded-md border border-border/60 bg-input/30 px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox checked={isPrivate} onCheckedChange={setIsPrivate} />
          Repositório privado
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || publishing} className="gap-2">
            {publishing ? <Spinner size="md" /> : <GithubIcon className="size-4" />}
            Publicar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
