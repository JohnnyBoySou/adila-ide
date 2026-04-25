import { useCallback } from "react";
import { useConfig } from "./useConfig";

const KEY = "workbench.recentFolders";
const MAX = 10;
const EMPTY: string[] = [];

export function useRecentFolders() {
  const { value: folders, set } = useConfig<string[]>(KEY, EMPTY);

  const push = useCallback(
    (path: string) => {
      const next = [path, ...(folders ?? []).filter((p) => p !== path)].slice(0, MAX);
      return set(next);
    },
    [folders, set],
  );

  const remove = useCallback(
    (path: string) => set((folders ?? []).filter((p) => p !== path)),
    [folders, set],
  );

  return { folders: folders ?? EMPTY, push, remove };
}
