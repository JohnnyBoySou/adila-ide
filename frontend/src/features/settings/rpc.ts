import { call, on } from "@/rpc/core";

export const rpc = {
  config: {
    get: <T>(key: string, defaultValue?: T) => call<T>("config.get", { key, defaultValue }),
    set: (key: string, value: unknown) => call<void>("config.set", { key, value }),
    reset: (key: string) => call<void>("config.reset", { key }),
  },
  settings: {
    openJson: () => call<void>("settings.openJson"),
  },
  on,
};
