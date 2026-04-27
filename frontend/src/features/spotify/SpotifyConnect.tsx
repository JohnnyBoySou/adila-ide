import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SpotifyIcon } from "./SpotifyIcon";
import { useSpotifyAuth } from "./useSpotifyAuth";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface SpotifyConnectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function SpotifyConnect({ open, onOpenChange, onConnected }: SpotifyConnectProps) {
  const { connected, connecting, error, connect } = useSpotifyAuth();
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open && connected) {
      onConnected?.();
      onOpenChange(false);
    }
  }, [open, connected, onConnected, onOpenChange]);

  useEffect(() => {
    if (!open) setLocalError(null);
  }, [open]);

  const handleConnect = async () => {
    setLocalError(null);
    try {
      await connect();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel/i.test(msg)) setLocalError(msg);
    }
  };

  const errorMessage = localError ?? error;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Conectar ao Spotify"
      align="center"
      className="max-w-md overflow-hidden p-0"
    >
      <div className="relative">
        {/* Hero: sempre escuro com glow verde para evocar a marca Spotify */}
        <div className="relative isolate overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black px-7 pt-9 pb-7">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute -top-24 -right-16 size-72 rounded-full bg-green-500/30 blur-3xl"
            />
            <motion.div
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.05 }}
              className="absolute -bottom-28 -left-12 size-72 rounded-full bg-emerald-500/20 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
                maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
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
              <div className="absolute inset-0 -m-3 rounded-3xl bg-green-500/40 blur-2xl" />
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-[#1DB954] text-black shadow-[0_10px_40px_-8px_rgb(29_185_84/0.55)] ring-1 ring-white/20">
                <SpotifyIcon className="size-9" />
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="text-[17px] font-semibold tracking-tight text-white"
            >
              Conectar com Spotify
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
              className="mt-1.5 max-w-[20rem] text-xs leading-relaxed text-zinc-400"
            >
              Para controlar a reprodução, ver playlists e a faixa atual direto do Adila IDE.
            </motion.p>
          </div>
        </div>

        {/* Corpo */}
        <div className="px-7 pt-6 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            {!connecting ? (
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
                    Vamos abrir o Spotify no seu navegador para você autorizar via OAuth. O Adila
                    recebe apenas um token revogável.
                  </p>
                  <p>
                    Recursos de play e pause exigem conta{" "}
                    <span className="font-semibold text-foreground">Premium</span>. Navegação e
                    biblioteca funcionam em qualquer plano.
                  </p>
                </div>

                <Button
                  onClick={() => void handleConnect()}
                  size="lg"
                  className="mt-1 h-11 gap-2 bg-[#1DB954] text-black shadow-lg hover:bg-[#1ed760]"
                >
                  <SpotifyIcon className="size-4" />
                  Iniciar autenticação
                </Button>

                {errorMessage && (
                  <p className="text-center text-xs text-destructive">{errorMessage}</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="connecting"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="relative">
                    <span
                      aria-hidden
                      className="absolute inset-0 -m-2 animate-ping rounded-full bg-[#1DB954]/30"
                    />
                    <span className="relative flex size-12 items-center justify-center rounded-full bg-[#1DB954]/15 text-[#1DB954]">
                      <Spinner size="md" />
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Aguardando autorização no navegador
                  </p>
                  <p className="max-w-[20rem] text-xs leading-relaxed text-muted-foreground">
                    Confirme o acesso na aba aberta. Voltaremos automaticamente quando você
                    concluir.
                  </p>
                </div>

                <div className="flex justify-center pt-1">
                  <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                    Cancelar
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
