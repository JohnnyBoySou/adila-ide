import { Call as $Call } from "@wailsio/runtime";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "application/pdf": "pdf",
};

const PREFERRED_BINARY_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/bmp",
  "application/pdf",
];

function extFor(mime: string): string {
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  const tail = mime.split("/")[1] ?? "bin";
  return tail.replace(/[^a-z0-9]+/gi, "").toLowerCase() || "bin";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export type PasteResult =
  | { kind: "ok"; written: { path: string; mime: string }[] }
  | { kind: "empty" }
  | { kind: "error"; message: string };

/**
 * Lê o clipboard e grava cada item binário (imagem, PDF, etc.) como arquivo
 * em `targetDir`. Para conteúdo de texto puro, salva como `.txt`.
 *
 * Requer Clipboard API (navigator.clipboard.read). Em ambientes que negam
 * permissão, o usuário precisa autorizar o navegador/WebView.
 */
export async function pasteClipboardIntoDir(targetDir: string): Promise<PasteResult> {
  if (!targetDir) return { kind: "error", message: "Pasta de destino inválida." };

  if (!("clipboard" in navigator) || typeof navigator.clipboard.read !== "function") {
    return {
      kind: "error",
      message: "Navegador sem suporte a leitura do clipboard.",
    };
  }

  let items: ClipboardItem[];
  try {
    items = await navigator.clipboard.read();
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  if (items.length === 0) return { kind: "empty" };

  const written: { path: string; mime: string }[] = [];
  const stamp = timestamp();
  let idx = 0;

  for (const item of items) {
    const mime =
      PREFERRED_BINARY_TYPES.find((t) => item.types.includes(t)) ??
      item.types.find((t) => t.startsWith("image/") || t.startsWith("application/")) ??
      (item.types.includes("text/plain") ? "text/plain" : null);

    if (!mime) continue;

    try {
      const blob = await item.getType(mime);
      const ext = mime === "text/plain" ? "txt" : extFor(mime);
      const suffix = items.length > 1 ? `-${++idx}` : "";
      const name = `colado-${stamp}${suffix}.${ext}`;
      const path = `${targetDir.replace(/\/+$/, "")}/${name}`;

      const b64 = await blobToBase64(blob);
      await $Call.ByName("main.App.WriteFileBase64", path, b64);
      written.push({ path, mime });
    } catch (e) {
      return {
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (written.length === 0) return { kind: "empty" };
  return { kind: "ok", written };
}

function filenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    if (!last) return null;
    return decodeURIComponent(last);
  } catch {
    return null;
  }
}

const HAS_EXT_RE = /\.[a-z0-9]{2,8}$/i;

/**
 * Processa um evento de drop externo (arquivos de file manager, imagens
 * arrastadas do navegador, etc.) e grava cada item em `targetDir`. Ignora
 * drags internos do Adila (marcados com `application/x-adila-file`).
 */
export async function dropIntoDir(
  dataTransfer: DataTransfer,
  targetDir: string,
): Promise<PasteResult> {
  if (!targetDir) return { kind: "error", message: "Pasta de destino inválida." };

  const types = Array.from(dataTransfer.types ?? []);
  if (types.includes("application/x-adila-file")) {
    // Arrasto interno; deixa o app tratar.
    return { kind: "empty" };
  }

  const written: { path: string; mime: string }[] = [];
  const stamp = timestamp();
  const dir = targetDir.replace(/\/+$/, "");

  // 1) Arquivos reais do SO (file manager, save-as drag, screenshot tool).
  const files = dataTransfer.files;
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const fallback = `colado-${stamp}${files.length > 1 ? `-${i + 1}` : ""}.${extFor(
          file.type || "application/octet-stream",
        )}`;
        const name = file.name && file.name.trim() ? file.name : fallback;
        const path = `${dir}/${name}`;
        const b64 = await blobToBase64(file);
        await $Call.ByName("main.App.WriteFileBase64", path, b64);
        written.push({ path, mime: file.type });
      } catch (e) {
        return { kind: "error", message: e instanceof Error ? e.message : String(e) };
      }
    }
    return written.length > 0 ? { kind: "ok", written } : { kind: "empty" };
  }

  // 2) URLs (imagens arrastadas de páginas web, link da barra de endereço).
  const uriRaw =
    dataTransfer.getData("text/uri-list") || dataTransfer.getData("text/plain") || "";
  const urls = uriRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && /^(https?|data):/i.test(l));

  if (urls.length > 0) {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const ext = extFor(blob.type || "application/octet-stream");
        const fromUrl = filenameFromUrl(url);
        const base =
          fromUrl ?? `colado-${stamp}${urls.length > 1 ? `-${i + 1}` : ""}.${ext}`;
        const name = HAS_EXT_RE.test(base) ? base : `${base}.${ext}`;
        const path = `${dir}/${name}`;
        const b64 = await blobToBase64(blob);
        await $Call.ByName("main.App.WriteFileBase64", path, b64);
        written.push({ path, mime: blob.type });
      } catch (e) {
        return { kind: "error", message: e instanceof Error ? e.message : String(e) };
      }
    }
    return written.length > 0 ? { kind: "ok", written } : { kind: "empty" };
  }

  return { kind: "empty" };
}
