import { call, on } from "@/rpc/core";

export const rpc = {
  config: {
    get: <T>(key: string, defaultValue?: T) =>
      call<T>("config.get", { key, defaultValue }),
    set: (key: string, value: unknown) =>
      call<void>("config.set", { key, value }),
  },
  onboarding: {
    complete: () => call<void>("onboarding.complete"),
  },
  on,
};
