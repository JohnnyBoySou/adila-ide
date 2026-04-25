import { Get as configGet, Set as configSet } from "../../wailsjs/go/main/Config";
import type { SerializedNode } from "@/features/editor/panes";

export type Session = {
  rootPath: string;
  /** Lista plana de arquivos abertos (legado, mantido para compat). */
  openFiles: string[];
  activePath: string;
  /** Estrutura de panes serializada — quando presente substitui openFiles. */
  paneTree?: SerializedNode;
  focusedPaneId?: string;
};

const KEY = "workbench.session";

export async function loadSession(): Promise<Session | null> {
  try {
    const data = (await configGet(KEY, null)) as Session | null;
    if (!data || typeof data !== "object" || !data.rootPath) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await configSet(KEY, session);
  } catch {
    // silencia — salvar sessão não é crítico
  }
}
