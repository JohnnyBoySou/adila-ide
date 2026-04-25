import { Get as configGet, Set as configSet } from "../../wailsjs/go/main/Config";

type Session = {
  rootPath: string;
  openFiles: string[];
  activePath: string;
};

const KEY = "workbench.session";

export async function loadSession(): Promise<Session | null> {
  try {
    const data = await configGet(KEY, null) as Session | null;
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
