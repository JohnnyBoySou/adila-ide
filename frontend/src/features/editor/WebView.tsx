import { ArrowLeft, ArrowRight, ExternalLink, Globe, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";

export const WEBVIEW_PREFIX = "webview://";

export function isWebviewPath(path: string): boolean {
  return path.startsWith(WEBVIEW_PREFIX);
}

export function urlFromWebviewPath(path: string): string {
  return path.slice(WEBVIEW_PREFIX.length);
}

export function webviewPathFromUrl(url: string): string {
  return `${WEBVIEW_PREFIX}${url}`;
}

export function webviewLabel(path: string): string {
  const url = urlFromWebviewPath(path);
  try {
    const u = new URL(url);
    const port = u.port ? `:${u.port}` : "";
    return `${u.hostname}${port}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

type Props = {
  path: string;
  onNavigate?: (path: string, newPath: string) => void;
};

export function WebView({ path, onNavigate }: Props) {
  const initialUrl = urlFromWebviewPath(path);
  const [address, setAddress] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const next = urlFromWebviewPath(path);
    setAddress(next);
    setCurrentUrl(next);
  }, [path]);

  function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^localhost(:\d+)?(\/|$)/i.test(trimmed) || trimmed.startsWith("127.0.0.1")) {
      return `http://${trimmed}`;
    }
    return `https://${trimmed}`;
  }

  function go(target?: string) {
    const url = normalizeUrl(target ?? address);
    if (!url) return;
    setAddress(url);
    setCurrentUrl(url);
    setReloadKey((k) => k + 1);
    onNavigate?.(path, webviewPathFromUrl(url));
  }

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function back() {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      /* cross-origin: ignored */
    }
  }

  function forward() {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      /* cross-origin: ignored */
    }
  }

  function openExternal() {
    if (currentUrl) BrowserOpenURL(currentUrl);
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <Button variant="ghost" size="icon" className="size-7" onClick={back} aria-label="Voltar">
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={forward}
          aria-label="Avançar"
        >
          <ArrowRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={reload}
          aria-label="Recarregar"
        >
          <RotateCw className="size-4" />
        </Button>
        <div className="relative flex-1">
          <Globe className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") go();
            }}
            className="h-7 pl-7 text-xs"
            placeholder="http://localhost:5173"
            spellCheck={false}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={openExternal}
          aria-label="Abrir no navegador"
        >
          <ExternalLink className="size-4" />
        </Button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        {currentUrl ? (
          <iframe
            key={reloadKey}
            ref={iframeRef}
            src={currentUrl}
            className="absolute inset-0 size-full border-0 bg-white"
            sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
            title={`webview-${currentUrl}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Digite uma URL para começar.
          </div>
        )}
      </div>
    </div>
  );
}
