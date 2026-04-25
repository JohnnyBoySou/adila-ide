import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ClosePty, GetPty, StartPtyWith } from "../../../wailsjs/go/main/Terminal";

export type TermSession = {
  id: string;
  title: string;
  cwd: string;
  shell: string;
  running: boolean;
  exitCode: number;
};

type CreateOpts = { cwd?: string; shell?: string };

type TermStore = {
  sessions: TermSession[];
  activeId: string;
  create: (opts?: CreateOpts) => Promise<string>;
  close: (id: string) => void;
  focus: (id: string) => void;
  updateSession: (id: string, patch: Partial<TermSession>) => void;
};

const Ctx = createContext<TermStore | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [activeId, setActiveId] = useState("");
  const counterRef = useRef(1);

  const create = useCallback(async ({ cwd = "", shell = "" }: CreateOpts = {}) => {
    const id = await StartPtyWith({ cwd, shell, args: [], env: {}, cols: 80, rows: 24 });

    // busca metadados reais (shell resolvido, pid) do backend
    let resolvedShell = shell;
    try {
      const info = await GetPty(id);
      resolvedShell = info.shell;
    } catch {}

    const n = counterRef.current++;
    const shortShell = resolvedShell.split("/").pop() ?? (resolvedShell || "shell");
    const session: TermSession = {
      id,
      title: `${shortShell} ${n}`,
      cwd,
      shell: resolvedShell,
      running: true,
      exitCode: 0,
    };
    setSessions((s) => [...s, session]);
    setActiveId(id);
    return id;
  }, []);

  const close = useCallback((id: string) => {
    ClosePty(id).catch(() => {});
    setSessions((prev) => {
      const next = prev.filter((x) => x.id !== id);
      // ajusta activeId dentro do setter pra evitar stale closure
      setActiveId((cur) => {
        if (cur !== id) return cur;
        return next.length ? next[next.length - 1].id : "";
      });
      return next;
    });
  }, []);

  const focus = useCallback((id: string) => setActiveId(id), []);

  const updateSession = useCallback(
    (id: string, patch: Partial<TermSession>) =>
      setSessions((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    [],
  );

  const value = useMemo(
    () => ({ sessions, activeId, create, close, focus, updateSession }),
    [sessions, activeId, create, close, focus, updateSession],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTerminals(): TermStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTerminals must be inside TerminalProvider");
  return ctx;
}
