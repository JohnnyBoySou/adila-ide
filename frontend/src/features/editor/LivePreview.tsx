import { useUiStore } from "@/stores/uiStore";
import { WebView, urlFromWebviewPath, webviewPathFromUrl } from "./WebView";

/**
 * Painel de preview ao vivo — reusa o WebView interno com a URL configurada
 * no uiStore. Mudanças de URL feitas dentro da barra de endereço do WebView
 * são propagadas pro store e persistidas no localStorage, então a próxima
 * sessão abre na mesma URL.
 */
export function LivePreview() {
  const url = useUiStore((s) => s.livePreviewUrl);
  const setUrl = useUiStore((s) => s.setLivePreviewUrl);
  const path = webviewPathFromUrl(url);

  return (
    <WebView
      path={path}
      onNavigate={(_oldPath, newPath) => {
        setUrl(urlFromWebviewPath(newPath));
      }}
    />
  );
}
