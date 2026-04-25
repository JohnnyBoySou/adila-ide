/**
 * Camada RPC entre o frontend React e o backend Go (Wails).
 *
 * call()  — roteia chamadas por nome de método para os bindings Wails gerados.
 * on()    — escuta eventos emitidos pelo Go via wruntime.EventsEmit.
 *
 * Adicionar um novo método: crie a rota em `routes` abaixo apontando para o
 * binding correspondente em wailsjs/go/main/<Struct>.
 */

import * as Config from "../../wailsjs/go/main/Config";
import * as About from "../../wailsjs/go/main/About";
import * as CommandCenter from "../../wailsjs/go/main/CommandCenter";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { listVersions, getReleaseNotes } from "../features/about/releaseNotesData";

type P = Record<string, unknown> | undefined;

// Cada entrada mapeia "namespace.método" para uma função que recebe os params
// (já deserializados do JSON pelo Wails) e retorna uma Promise.
const routes: Record<string, (p: P) => Promise<unknown>> = {
  // ── Config ──────────────────────────────────────────────────────────────────
  "config.get": (p) =>
    Config.Get((p?.key as string) ?? "", p?.defaultValue ?? null),
  "config.set": (p) =>
    Config.Set((p?.key as string) ?? "", p?.value ?? null),
  "config.reset": (p) =>
    Config.Reset((p?.key as string) ?? ""),

  // ── Settings ─────────────────────────────────────────────────────────────────
  "settings.openJson": () => Config.OpenSettingsJson(),

  // ── About ────────────────────────────────────────────────────────────────────
  "product.info": () => About.GetProductInfo(),
  "shell.openUrl": (p) => About.OpenUrl((p?.url as string) ?? ""),
  "system.copyVersionInfo": () =>
    About.GetProductInfo().then((info) => {
      const i = info as { version: string; name: string };
      return navigator.clipboard.writeText(`${i.name} v${i.version}`);
    }),

  // ── Updates (não implementado ainda — desabilitado) ───────────────────────────
  "update.getState": () => Promise.resolve({ type: "disabled", reason: "Auto-update não disponível nesta versão." }),
  "update.check": () => Promise.resolve(),
  "update.download": () => Promise.resolve(),
  "update.apply": () => Promise.resolve(),
  "update.restart": () => Promise.resolve(),

  // ── Release Notes (dados estáticos) ─────────────────────────────────────────
  "releaseNotes.listVersions": () => Promise.resolve(listVersions()),
  "releaseNotes.get": (p) => Promise.resolve(getReleaseNotes((p?.version as string) ?? "")),

  // ── Onboarding ───────────────────────────────────────────────────────────────
  "onboarding.complete": () => Config.Set("onboarding.completed", true),

  // ── CommandCenter ────────────────────────────────────────────────────────────
  "commandCenter.list": (p) =>
    CommandCenter.List((p?.mode as string) ?? "commands", (p?.query as string) ?? ""),
  "commandCenter.execute": (p) => CommandCenter.Execute((p?.id as string) ?? ""),
  "commandCenter.gotoLine": (p) =>
    CommandCenter.GotoLine((p?.line as number) ?? 1, (p?.column as number) ?? 1),
  "commandCenter.ready": () => Promise.resolve(),
  "commandCenter.close": () => Promise.resolve(),

  // ── File system (command palette index) ─────────────────────────────────────
  "fs.listWorkspaceRoots": () => CommandCenter.GetWorkspaceRoots(),
  "fs.listAllFiles": () => CommandCenter.ListAllFiles(),

  // ── Editor ───────────────────────────────────────────────────────────────────
  "editor.open": (p) => CommandCenter.OpenFile((p?.path as string) ?? ""),
};

export function call<T>(method: string, params?: unknown): Promise<T> {
  const handler = routes[method];
  if (!handler) {
    return Promise.reject(new Error(`rpc: método não registrado: "${method}"`));
  }
  return handler(params as P) as Promise<T>;
}

/**
 * Escuta um evento emitido pelo Go (wruntime.EventsEmit).
 * Retorna uma função de cleanup que remove o listener.
 *
 * Eventos conhecidos emitidos pelo backend:
 *   "config.changed"   — { key: string, value: unknown }
 *   "git.changed"      — (sem payload)
 *   "editor.openFile"  — string (caminho absoluto)
 *   "pty:data:<id>"    — string (base64)
 *   "pty:exit:<id>"    — number (exit code)
 */
// State in-memory de sessão (não persistido). Usado por features que precisam
// guardar pequenos dados enquanto o app está aberto (ex: FileTree scroll/expand).
const sessionState = new Map<string, unknown>();
const STATE_KEY = "__rpc_state__";

export const state = {
  get<T>(): T | undefined {
    return sessionState.get(STATE_KEY) as T | undefined;
  },
  set<T>(value: T): void {
    sessionState.set(STATE_KEY, value);
  },
};

export function on(
  event: string,
  handler: (payload: unknown) => void,
): () => void {
  // EventsOn retorna a função de cleanup no Wails v2
  return EventsOn(event, handler);
}
