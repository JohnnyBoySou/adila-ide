import { call, on } from "@/rpc/core";
import type { ProductInfo, ReleaseNotesPayload, UpdateState, VersionMeta } from "./types";

export const rpc = {
  productInfo: () => call<ProductInfo>("product.info"),
  getUpdateState: () => call<UpdateState>("update.getState"),
  checkForUpdates: () => call<void>("update.check"),
  downloadUpdate: () => call<void>("update.download"),
  applyUpdate: () => call<void>("update.apply"),
  restartForUpdate: () => call<void>("update.restart"),
  listVersions: () => call<VersionMeta[]>("releaseNotes.listVersions"),
  getReleaseNotes: (version: string) =>
    call<ReleaseNotesPayload | null>("releaseNotes.get", { version }),
  copyVersionInfo: () => call<void>("system.copyVersionInfo"),
  openUrl: (url: string) => call<void>("shell.openUrl", { url }),
  onUpdateState: (handler: (state: UpdateState) => void) =>
    on("update.stateChanged", (payload) => {
      handler(payload as UpdateState);
    }),
};
