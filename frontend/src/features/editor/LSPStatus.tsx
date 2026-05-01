import { useEffect, useRef, useState } from "react";
import { CheckCircle, Download, XCircle } from "lucide-react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { GetLSPStatus, InstallLSPServer } from "../../../wailsjs/go/main/LSP";
import { invalidateLSPAvailabilityCache } from "./useLSP";
import { Spinner } from "@/components/ui/spinner";

type ServerStatus = {
  lang: string;
  name: string;
  installed: boolean;
  path: string;
  installHint: string;
};

type InstallState = {
  installing: boolean;
  progress: number;
  error: string;
};

type LSPStatusProps = {
  // linguagem do arquivo ativo — destaca o servidor relevante
  activeLang?: string;
};

export function LSPStatus({ activeLang }: LSPStatusProps) {
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [installState, setInstallState] = useState<Record<string, InstallState>>({});
  const [open, setOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Esc fecha; click fora fecha (excluindo o trigger pra não toggle-cancelar).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popupRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  useEffect(() => {
    GetLSPStatus()
      .then(setServers)
      .catch(() => {});
  }, []);

  // escuta eventos de progresso e conclusão
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    for (const lang of ["gopls", "rust-analyzer"]) {
      unsubs.push(
        EventsOn(`lsp:install:progress:${lang}`, (pct: number) => {
          setInstallState((s) => ({
            ...s,
            [lang]: { installing: true, progress: pct, error: "" },
          }));
        }),
      );
      unsubs.push(
        EventsOn(`lsp:install:done:${lang}`, () => {
          setInstallState((s) => ({
            ...s,
            [lang]: { installing: false, progress: 100, error: "" },
          }));
          // invalida o cache de disponibilidade do useLSP — abas abertas
          // só vão reconectar ao reabrir, mas novas abas pegam o servidor.
          invalidateLSPAvailabilityCache();
          // recarrega status após instalação
          GetLSPStatus()
            .then(setServers)
            .catch(() => {});
        }),
      );
    }

    return () => unsubs.forEach((u) => u());
  }, []);

  const install = async (lang: string) => {
    setInstallState((s) => ({
      ...s,
      [lang]: { installing: true, progress: 0, error: "" },
    }));
    try {
      await InstallLSPServer(lang);
    } catch (e) {
      setInstallState((s) => ({
        ...s,
        [lang]: { installing: false, progress: 0, error: String(e) },
      }));
    }
  };

  const activeServer = servers.find((s) => {
    if (activeLang === "go") return s.lang === "gopls";
    if (activeLang === "rust") return s.lang === "rust-analyzer";
    return false;
  });

  // indicator compacto na status bar
  const indicator = (() => {
    if (!activeServer) return null;
    if (activeServer.installed)
      return (
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-emerald-500 hover:opacity-80"
          title="LSP ativo"
        >
          <CheckCircle className="size-3" />
          {activeServer.lang}
        </button>
      );
    return (
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-amber-500 hover:opacity-80"
        title="LSP não instalado"
      >
        <XCircle className="size-3" />
        {activeServer.lang} não instalado
      </button>
    );
  })();

  return (
    <>
      <div ref={triggerRef} className="contents">
        {indicator}
      </div>

      {open && (
        <div
          ref={popupRef}
          className="fixed bottom-8 right-4 z-50 bg-popover border rounded-lg shadow-xl w-72 p-3 text-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Servidores LSP</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <p className="text-muted-foreground mb-3 text-[11px]">
            TypeScript, JavaScript, JSON, CSS e HTML rodam sem instalação — workers embutidos no
            editor.
          </p>

          <div className="space-y-2">
            {servers.map((s) => {
              const state = installState[s.lang];
              const isInstalling = state?.installing;
              const hasError = state?.error;

              return (
                <div key={s.lang} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.installed ? (
                      <CheckCircle className="size-3.5 text-emerald-500 shrink-0" />
                    ) : isInstalling ? (
                      <Spinner className="text-blue-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{s.name}</span>
                  </div>

                  <div className="shrink-0">
                    {s.installed ? (
                      <span className="text-muted-foreground">instalado</span>
                    ) : isInstalling ? (
                      <span className="text-blue-500 tabular-nums">{state.progress}%</span>
                    ) : (
                      <button
                        onClick={() => install(s.lang)}
                        title={s.installHint || undefined}
                        className="flex items-center gap-1 text-blue-500 hover:text-blue-400"
                      >
                        <Download className="size-3" />
                        instalar
                      </button>
                    )}
                  </div>

                  {hasError && (
                    <p className="text-destructive text-[10px] mt-0.5 pl-5">{state.error}</p>
                  )}
                  {!s.installed && !isInstalling && s.installHint && (
                    <p className="text-muted-foreground text-[10px] mt-0.5 pl-5">{s.installHint}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
