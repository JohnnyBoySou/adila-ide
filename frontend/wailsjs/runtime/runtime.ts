// Shim de compatibilidade Wails v2 -> v3.
// Mantém os símbolos EventsOn/EventsOff/EventsEmit/BrowserOpenURL/Quit/
// WindowMinimise/WindowToggleMaximise/WindowIsMaximised com a mesma
// assinatura usada no código v2 e delega para @wailsio/runtime.
//
// Quando o código for migrado caso a caso para `import { Events, Browser,
// Application, Window } from "@wailsio/runtime"`, este arquivo pode ser
// removido.

import { Events, Browser, Application, Window } from "@wailsio/runtime";

type Listener = (...args: any[]) => void;

function adaptCallback(cb: Listener) {
  return (event: { data?: unknown }) => {
    const d = event?.data;
    if (d == null) {
      cb();
    } else if (Array.isArray(d)) {
      cb(...d);
    } else {
      cb(d);
    }
  };
}

export function EventsOn(name: string, callback: Listener): () => void {
  return Events.On(name as any, adaptCallback(callback) as any);
}

export function EventsOnce(name: string, callback: Listener): () => void {
  return Events.Once(name as any, adaptCallback(callback) as any);
}

export function EventsOnMultiple(
  name: string,
  callback: Listener,
  maxCallbacks: number,
): () => void {
  return Events.OnMultiple(name as any, adaptCallback(callback) as any, maxCallbacks);
}

export function EventsOff(...names: string[]): void {
  if (names.length === 0) return;
  // Events.Off requer um tuple não-vazio; a checagem acima garante.
  (Events.Off as (...n: string[]) => void)(...names);
}

export function EventsOffAll(): void {
  Events.OffAll();
}

export function EventsEmit(name: string, ...data: any[]): void {
  // v2 aceitava múltiplos payloads; v3 só carrega um. Quando há mais de um,
  // empacotamos como array : o handler v2-style já lida com isso ao despachar.
  const payload = data.length === 0 ? undefined : data.length === 1 ? data[0] : data;
  void Events.Emit(name as any, payload as any);
}

export function BrowserOpenURL(url: string): void {
  void Browser.OpenURL(url);
}

export function Quit(): void {
  void Application.Quit();
}

export function WindowMinimise(): void {
  void Window.Minimise();
}

export function WindowToggleMaximise(): void {
  void Window.ToggleMaximise();
}

export function WindowIsMaximised(): Promise<boolean> {
  return Window.IsMaximised();
}
