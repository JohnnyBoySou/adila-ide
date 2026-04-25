import { useEffect, useRef } from "react";
import { MonacoLanguageClient } from "monaco-languageclient";
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from "vscode-ws-jsonrpc";
import { CloseAction, ErrorAction } from "vscode-languageclient";
import { GetLSPPort } from "../../../wailsjs/go/main/LSP";

let portCache: number | null = null;
async function getLSPPort(): Promise<number> {
  if (portCache !== null) return portCache;
  portCache = await GetLSPPort();
  return portCache;
}

// JSON, CSS, HTML têm worker embutido no Monaco — não precisam de LSP externo.
const MONACO_BUILTIN = new Set(["json", "css", "html"]);

// Clientes vivos indexados por "lang::rootUri" — compartilhados entre abas.
const activeClients = new Map<string, MonacoLanguageClient>();

type UseLSPOptions = {
  lang: string;
  rootUri: string;
  enabled?: boolean;
};

export function useLSP({ lang, rootUri, enabled = true }: UseLSPOptions) {
  const clientRef = useRef<MonacoLanguageClient | null>(null);

  useEffect(() => {
    if (!enabled || !lang || !rootUri || MONACO_BUILTIN.has(lang)) return;

    const key = `${lang}::${rootUri}`;

    // reutiliza cliente existente se o root+lang já estiver ativo
    if (activeClients.has(key)) {
      clientRef.current = activeClients.get(key)!;
      return;
    }

    let ws: WebSocket | null = null;
    let disposed = false;

    const connect = async () => {
      let port: number;
      try {
        port = await getLSPPort();
      } catch {
        return;
      }
      if (disposed) return;

      const rootParam = encodeURIComponent(rootUri);
      ws = new WebSocket(`ws://127.0.0.1:${port}/lsp/${lang}?root=${rootParam}`);

      ws.binaryType = "arraybuffer";

      ws.onerror = () => {
        // servidor LSP não instalado — falha silenciosa
        activeClients.delete(key);
      };

      ws.onclose = () => {
        if (!disposed) activeClients.delete(key);
      };

      ws.onopen = () => {
        if (disposed || !ws) return;

        const socket = toSocket(ws);
        const reader = new WebSocketMessageReader(socket);
        const writer = new WebSocketMessageWriter(socket);

        const client = new MonacoLanguageClient({
          name: `${lang} LSP`,
          clientOptions: {
            documentSelector: [
              { language: lang },
              // typescript-language-server também cobre javascript
              ...(lang === "typescript" ? [{ language: "javascript" }] : []),
            ],
            errorHandler: {
              error: () => ({ action: ErrorAction.Continue }),
              closed: () => ({ action: CloseAction.DoNotRestart }),
            },
          },
          messageTransports: { reader, writer },
        });

        clientRef.current = client;
        activeClients.set(key, client);
        client.start();
      };
    };

    void connect();

    return () => {
      disposed = true;
      // mantém o cliente vivo — ele é compartilhado por todas as abas do mesmo root.
      // Wails limpa os processos LSP no shutdown via lsp.shutdown().
    };
  }, [lang, rootUri, enabled]);

  return clientRef;
}
