import { IsEnabled, Reset, SetEnabled, Stats } from "../../../wailsjs/go/main/Bench";
import type { main } from "../../../wailsjs/go/models";

export type BenchOp = main.BenchOp;

export const rpc = {
  bench: {
    stats: () => Stats() as Promise<BenchOp[]>,
    reset: () => Reset(),
    setEnabled: (enabled: boolean) => SetEnabled(enabled),
    isEnabled: () => IsEnabled() as Promise<boolean>,
  },
};
