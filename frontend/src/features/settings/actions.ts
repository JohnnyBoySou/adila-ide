import { clearProfile, downloadProfile } from "@/components/DevProfiler";
import { Reindex } from "../../../wailsjs/go/main/Indexer";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
import { toast } from "@/hooks/useToast";

export type SettingActionId =
  | "downloadProfile"
  | "clearProfile"
  | "openClaudeConnect"
  | "openCodexConnect"
  | "reindexWorkspace";

export const settingActions: Record<SettingActionId, () => void> = {
  downloadProfile,
  clearProfile,
  // Reaproveita o mesmo modal usado no welcome em vez de duplicar a UI de
  // input de API key dentro do SettingsView.
  openClaudeConnect: () => EventsEmit("claude.openConnect"),
  openCodexConnect: () => EventsEmit("codex.openConnect"),
  reindexWorkspace: () => {
    void Reindex()
      .then(() => toast.success("Reindexação iniciada", "Acompanhe o progresso na status bar."))
      .catch((err: unknown) => toast.error("Falha ao reindexar", err));
  },
};
