import { useEffect } from "react";
import type * as monaco from "monaco-editor";
import { GetLSPPort, ListAvailableLSP } from "../../../wailsjs/go/main/LSP";
import { toast } from "@/hooks/useToast";
import { getOrCreateClient, isLSPRelevant } from "./lspBridge";

let portCache: number | null = null;
async function getLSPPort(): Promise<number> {
  if (portCache !== null) return portCache;
  portCache = await GetLSPPort();
  return portCache;
}

let availableCache: Promise<Record<string, string>> | null = null;
function getAvailableLSP(): Promise<Record<string, string>> {
  if (!availableCache) {
    availableCache = ListAvailableLSP().catch(() => ({}));
  }
  return availableCache;
}

export function invalidateLSPAvailabilityCache() {
  availableCache = null;
}

// Toasts são deduplicados por mensagem — evita spam quando vários arquivos
// disparam o mesmo erro (ex: LSP não instalado).
const recentErrors = new Set<string>();
function reportError(msg: string, err?: unknown) {
  console.warn(`[LSP] ${msg}`, err);
  if (recentErrors.has(msg)) return;
  recentErrors.add(msg);
  setTimeout(() => recentErrors.delete(msg), 30_000);
  toast.error(msg, err instanceof Error ? err.message : undefined);
}

type Monaco = typeof import("monaco-editor");

type UseLSPOptions = {
  monaco: Monaco | null;
  model: monaco.editor.ITextModel | null;
  lang: string;
  rootUri: string;
  enabled?: boolean;
};

/**
 * Conecta um modelo Monaco ao servidor LSP correspondente. O cliente é
 * compartilhado por (lang, rootUri) — todas as abas do mesmo projeto reusam
 * a conexão. didOpen/didChange/didClose são gerenciados automaticamente.
 */
export function useLSP({ monaco, model, lang, rootUri, enabled = true }: UseLSPOptions) {
  useEffect(() => {
    if (!enabled || !monaco || !model || !rootUri || !isLSPRelevant(lang)) return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    void (async () => {
      const available = await getAvailableLSP();
      if (cancelled) return;
      if (!available[lang]) {
        // servidor não instalado — silencioso (LSPStatus mostra o aviso no rodapé)
        return;
      }

      let port: number;
      try {
        port = await getLSPPort();
      } catch (err) {
        reportError("Não foi possível obter a porta do servidor LSP", err);
        return;
      }
      if (cancelled) return;

      const client = await getOrCreateClient({
        monaco,
        lang,
        rootUri,
        port,
        onError: reportError,
      });
      if (cancelled || !client) return;
      detach = client.attachModel(model);
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [monaco, model, lang, rootUri, enabled]);
}
