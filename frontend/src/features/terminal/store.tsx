import type { ReactNode } from "react";
import { create } from "zustand";
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

type AttachOpts = { id: string; cwd?: string; shell?: string; title?: string };

type TermStore = {
  sessions: TermSession[];
  activeId: string;
  create: (opts?: CreateOpts) => Promise<string>;
  attach: (opts: AttachOpts) => void;
  close: (id: string) => void;
  focus: (id: string) => void;
  updateSession: (id: string, patch: Partial<TermSession>) => void;
};

let counter = 1;

export const useTerminals = create<TermStore>((set) => ({
  sessions: [],
  activeId: "",

  create: async ({ cwd = "", shell = "" }: CreateOpts = {}) => {
    const id = await StartPtyWith({ cwd, shell, args: [], env: {}, cols: 80, rows: 24 });

    let resolvedShell = shell;
    try {
      const info = await GetPty(id);
      resolvedShell = info.shell;
    } catch {}

    const n = counter++;
    const shortShell = resolvedShell.split("/").pop() ?? (resolvedShell || "shell");
    const session: TermSession = {
      id,
      title: `${shortShell} ${n}`,
      cwd,
      shell: resolvedShell,
      running: true,
      exitCode: 0,
    };
    set((s) => ({ sessions: [...s.sessions, session], activeId: id }));
    return id;
  },

  attach: ({ id, cwd = "", shell = "", title }: AttachOpts) => {
    set((s) => {
      if (s.sessions.some((x) => x.id === id)) {
        return { activeId: id };
      }
      const n = counter++;
      const shortShell = shell ? (shell.split("/").pop() ?? shell) : "task";
      return {
        sessions: [
          ...s.sessions,
          {
            id,
            title: title ?? `${shortShell} ${n}`,
            cwd,
            shell,
            running: true,
            exitCode: 0,
          },
        ],
        activeId: id,
      };
    });
  },

  close: (id: string) => {
    ClosePty(id).catch(() => {});
    set((s) => {
      const next = s.sessions.filter((x) => x.id !== id);
      const nextActive =
        s.activeId !== id ? s.activeId : next.length ? next[next.length - 1].id : "";
      return { sessions: next, activeId: nextActive };
    });
  },

  focus: (id: string) => set({ activeId: id }),

  updateSession: (id: string, patch: Partial<TermSession>) =>
    set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
}));

// Mantido como pass-through para compat com main.tsx — store agora é
// module-level, não precisa de Provider, mas remover quebraria a árvore.
export function TerminalProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
