import { call, on } from "@/rpc/core";
import type { LayoutMode } from "./types";

export const rpc = {
  ready: () => call<void>("notifications.ready"),
  setLayout: (mode: LayoutMode) => call<void>("notifications.layout", { mode }),
  runAction: (id: string, kind: "primary" | "secondary", index: number) =>
    call<void>("notification.action", { id, kind, index }),
  close: (id: string) => call<void>("notification.close", { id }),
  toggleExpand: (id: string) => call<void>("notification.toggleExpand", { id }),
  clearAll: () => call<void>("notification.clearAll"),
  setCenterVisibility: (open: boolean) => call<void>("notifications.centerVisibility", { open }),
  on,
};
