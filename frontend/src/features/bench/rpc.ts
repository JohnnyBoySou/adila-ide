import {
  IsEnabled,
  ListHistory,
  OpenHistoryFolder,
  ReadHistory,
  Reset,
  SetEnabled,
  Stats,
} from "../../../wailsjs/go/main/Bench";
import type { main } from "../../../wailsjs/go/models";

export type BenchOp = main.BenchOp;
export type BenchHistoryFile = main.BenchHistoryFile;

export const rpc = {
  bench: {
    stats: () => Stats() as Promise<BenchOp[]>,
    reset: () => Reset(),
    setEnabled: (enabled: boolean) => SetEnabled(enabled),
    isEnabled: () => IsEnabled() as Promise<boolean>,
    history: () => ListHistory() as Promise<BenchHistoryFile[]>,
    read: (name: string) => ReadHistory(name) as Promise<string>,
    openFolder: () => OpenHistoryFolder(),
  },
};
