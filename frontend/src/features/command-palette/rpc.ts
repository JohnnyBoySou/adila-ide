import { call, on } from "@/rpc/core";
import type { Mode, PaletteItem } from "./types";

export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  mtime?: number;
};

export const rpc = {
  ready: () => call<void>("commandCenter.ready"),
  list: (mode: Mode, query: string) =>
    call<PaletteItem[]>("commandCenter.list", { mode, query }),
  execute: (mode: Mode, id: string) =>
    call<void>("commandCenter.execute", { mode, id }),
  gotoLine: (line: number, column?: number) =>
    call<void>("commandCenter.gotoLine", { line, column }),
  close: () => call<void>("commandCenter.close"),
  fs: {
    listWorkspaceRoots: () => call<FileEntry[]>("fs.listWorkspaceRoots"),
    listAllFiles: () => call<FileEntry[]>("fs.listAllFiles"),
  },
  editor: {
    open: (path: string) => call<void>("editor.open", { path }),
  },
  on,
};
