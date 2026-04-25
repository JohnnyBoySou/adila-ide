import { create } from "zustand";
import { rpc, type FileEntry } from "../rpc";

type Status = "idle" | "loading" | "ready" | "error";

interface FilesState {
  files: FileEntry[];
  roots: FileEntry[];
  status: Status;
  error: string | undefined;
  /** Load once; subsequent calls are no-ops while cache is ready or loading. */
  ensureLoaded: () => Promise<void>;
  /** Force a re-walk (after file system changes that invalidate the index). */
  reload: () => Promise<void>;
}

export const useFilesStore = create<FilesState>((set, get) => ({
  files: [],
  roots: [],
  status: "idle",
  error: undefined,
  ensureLoaded: async () => {
    const s = get().status;
    if (s === "loading" || s === "ready") {
      return;
    }
    set({ status: "loading", error: undefined });
    try {
      const [roots, files] = await Promise.all([
        rpc.fs.listWorkspaceRoots(),
        rpc.fs.listAllFiles(),
      ]);
      set({ roots, files, status: "ready" });
    } catch (err) {
      set({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  reload: async () => {
    set({ status: "idle", files: [], roots: [], error: undefined });
    await get().ensureLoaded();
  },
}));
