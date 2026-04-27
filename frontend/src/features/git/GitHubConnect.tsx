import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, LogOut } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Conectar ao GitHub"
      align="center"
      className="max-w-md overflow-hidden p-0"
    >
      <div className="relative">
        {/* Hero: sempre escuro para evocar a marca GitHub */}
        <div className="relative isolate overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-7 pt-9 pb-7">
          {/* Glows decorativos */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute -top-24 -right-16 size-72 rounded-full bg-blue-500/25 blur-3xl"
            />
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 }}
              className="absolute -bottom-28 -left-12 size-72 rounded-full bg-violet-500/20 blur-3xl"
            />
            {/* Grid sutil */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage:
                  "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              }}
            />
          </div>

          <div className="relative flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="relative mb-4"
            >
              <div className="absolute inset-0 -m-3 rounded-3xl bg-white/30 blur-2xl" />
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-white text-zinc-950 shadow-[0_10px_40px_-8px_rgb(255_255_255/0.35)] ring-1 ring-white/40">
                <GithubIcon className="size-8" />
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-[17px] font-semibold tracking-tight text-white"
            >
              Conectar com GitHub
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              className="mt-1.5 max-w-[20rem] text-xs leading-relaxed text-zinc-400"
            >
              Para publicar repositórios e enviar branches direto do Adila IDE.
            </motion.p>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-7 pt-6 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            {!device ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-2 text-center text-sm leading-relaxed text-foreground/80">
                  <p>
                    O Adila <strong className="font-semibold text-foreground">nunca</strong> vê
                    sua senha. Apenas um token revogável gerado pelo GitHub.
                  </p>
                  <p>
                    Você revisa e aprova o escopo{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-foreground">
                      repo
                    </code>{" "}
                    antes de qualquer ação.
                  </p>
                </div>

                <Button
                  onClick={start}
                  disabled={starting}
                  size="lg"
                  className="mt-1 h-11 gap-2 bg-zinc-950 text-white shadow-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  {starting ? <Spinner size="md" /> : <GithubIcon className="size-4" />}
                  {starting ? "Preparando..." : "Iniciar autenticação"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="device"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                {/* Código em estilo OTP */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="size-1 rounded-full bg-muted-foreground/60" />
                    Seu código de uso único
                    <span className="size-1 rounded-full bg-muted-foreground/60" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {device.userCode.split("").map((ch, i) =>
                      ch === "-" ? (
                        <span
                          key={i}
                          aria-hidden
                          className="mx-1 h-[2px] w-3 rounded-full bg-foreground/25"
                        />
                      ) : (
                        <motion.span
                          key={i}
                          initial={{ opacity: 0, y: 10, scale: 0.85 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 24,
                            delay: 0.04 * i,
                          }}
                          className="flex size-10 items-center justify-center rounded-lg border border-border bg-card font-mono text-xl font-semibold text-foreground tabular-nums shadow-sm"
                        >
                          {ch}
                        </motion.span>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.span
                          key="copied"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.12 }}
                          className="inline-flex items-center gap-1.5 text-emerald-500"
                        >
                          <Check className="size-3.5" />
                          Copiado
                        </motion.span>
                      ) : (
                        <motion.span
                          key="copy"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.12 }}
                          className="inline-flex items-center gap-1.5"
                        >
                          <Copy className="size-3.5" />
                          Copiar código
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>

                {/* Timeline de passos */}
                <ol className="relative flex flex-col gap-3.5 border-l border-dashed border-border/70 pl-5">
                  <Step
                    n={1}
                    label={
                      <>
                        Abrimos{" "}
                        <button
                          type="button"
                          onClick={openVerification}
                          className="font-medium text-primary hover:underline"
                        >
                          {device.verificationUri.replace(/^https?:\/\//, "")}
                        </button>{" "}
                        no seu navegador.
                      </>
                    }
                  />
                  <Step
                    n={2}
                    label={
                      <>
                        Confirme o código e clique em{" "}
                        <span className="font-medium text-foreground">Authorize Adila IDE</span>.
                      </>
                    }
                  />
                  <Step
                    n={3}
                    active={polling}
                    label={
                      <span className="flex items-center gap-2">
                        Voltaremos automaticamente quando você concluir.
                      </span>
                    }
                  />
                </ol>

                {/* Indicador de polling */}
                {polling && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    Aguardando autorização no navegador...
                  </motion.div>
                )}

                <div className="flex justify-between gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button variant="outline" size="sm" onClick={openVerification} className="gap-2">
                    <ExternalLink className="size-3.5" />
                    Reabrir GitHub
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Dialog>
  );
}

function Step({
  n,
  label,
  active = false,
}: {
  n: number;
  label: React.ReactNode;
  active?: boolean;
}) {
  return (
    <li className="relative flex items-start gap-3 text-sm text-muted-foreground">
      <span
        className={
          "absolute -left-[27px] flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-popover " +
          (active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground")
        }
      >
        {active ? (
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground/70 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary-foreground" />
          </span>
        ) : (
          n
        )}
      </span>
      <span className="leading-relaxed">{label}</span>
    </li>
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
