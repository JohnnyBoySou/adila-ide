import { call, on, state } from "@/rpc/core";

export type FileEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  mtime?: number;
};

export const rpc = {
  fs: {
    listWorkspaceRoots: () => call<FileEntry[]>("fs.listWorkspaceRoots"),
    list: (path: string) => call<FileEntry[]>("fs.list", { path }),
    rename: (from: string, to: string) =>
      call<void>("fs.rename", { from, to }),
    createFile: (parent: string, name: string) =>
      call<string>("fs.createFile", { parent, name }),
    createDirectory: (parent: string, name: string) =>
      call<string>("fs.createDirectory", { parent, name }),
    delete: (path: string) => call<void>("fs.delete", { path }),
  },
  editor: {
    open: (path: string) => call<void>("editor.open", { path }),
  },
  workspace: {
    chooseFolder: () => call<void>("workspace.chooseFolder"),
  },
  on,
  state,
};
