import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { CodexIcon } from "./CodexIcon";
import { useCodexAuth } from "./useCodexAuth";

interface CodexConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const CONSOLE_URL = "https://platform.openai.com/api-keys";

export function CodexConnect({ open, onOpenChange, onSaved }: CodexConnectProps) {
  const { configured, masked, save, saving, error, disconnect } = useCodexAuth();
  const [apiKey, setApiKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [validate, setValidate] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setApiKey("");
      setLocalError(null);
      setReveal(false);
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setLocalError("Cole a API key para continuar.");
      return;
    }
    setLocalError(null);
    try {
      await save(trimmed, validate);
      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
    }
  };

  const handleDisconnect = async () => {
    setLocalError(null);
    try {
      await disconnect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
    }
  };

  const errorMessage = localError ?? error;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Configurar Codex (OpenAI)"
      align="center"
      className="max-w-md overflow-hidden p-0"
    >
      <div className="relative">
        {/* Hero — paleta OpenAI: preto absoluto + verde-teal sutil */}
        <div className="relative isolate overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-7 pt-9 pb-7">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute -top-24 -right-16 size-72 rounded-full bg-teal-400/20 blur-3xl"
            />
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 }}
              className="absolute -bottom-28 -left-12 size-72 rounded-full bg-emerald-500/15 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
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
              <div className="absolute inset-0 -m-3 rounded-3xl bg-emerald-400/30 blur-2xl" />
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-black text-white shadow-[0_10px_40px_-8px_rgb(0_0_0/0.65)] ring-1 ring-white/15">
                <CodexIcon className="size-9" />
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-[17px] font-semibold tracking-tight text-white"
            >
              {configured ? "Codex conectado" : "Conectar com Codex"}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              className="mt-1.5 max-w-[20rem] text-xs leading-relaxed text-zinc-400"
            >
              {configured
                ? `Sua API key (${masked}) está salva. Substitua-a abaixo ou desconecte.`
                : "Cole sua API key da OpenAI para usar o Codex como agente do Adila."}
            </motion.p>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-7 pt-6 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.form
              key="form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-foreground/80" htmlFor="codex-api-key">
                  API key
                </label>
                <div className="relative">
                  <KeyRound
                    aria-hidden
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    ref={inputRef}
                    id="codex-api-key"
                    type={reveal ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-proj-..."
                    className="pl-9 pr-10 font-mono text-sm"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    aria-label={reveal ? "Ocultar" : "Mostrar"}
                    onClick={() => setReveal((r) => !r)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => BrowserOpenURL(CONSOLE_URL)}
                  className="inline-flex items-center gap-1 self-start text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Gerar uma key no OpenAI Platform
                  <ExternalLink className="size-3" />
                </button>
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground/80 select-none">
                <Checkbox checked={validate} onCheckedChange={setValidate} className="mt-0.5" />
                <span className="leading-snug">
                  Validar com a OpenAI antes de salvar (chama /v1/models, sem custo de tokens).
                </span>
              </label>

              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={saving || !apiKey.trim()}
                  className="h-11 gap-2 bg-emerald-500 text-black shadow-lg hover:bg-emerald-400"
                >
                  {saving ? (
                    <>
                      <Spinner size="sm" />
                      {validate ? "Validando…" : "Salvando…"}
                    </>
                  ) : (
                    <>
                      <CodexIcon className="size-4" />
                      {configured ? "Atualizar key" : "Salvar e conectar"}
                    </>
                  )}
                </Button>
                {configured && !saving && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDisconnect()}
                    className="text-destructive hover:text-destructive"
                  >
                    Desconectar
                  </Button>
                )}
              </div>

              {errorMessage && (
                <p className="text-center text-xs text-destructive">{errorMessage}</p>
              )}
            </motion.form>
          </AnimatePresence>
        </div>
      </div>
    </Dialog>
  );
}
