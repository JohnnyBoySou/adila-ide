import { clearProfile, downloadProfile } from "@/components/DevProfiler";

export type SettingActionId = "downloadProfile" | "clearProfile";

export const settingActions: Record<SettingActionId, () => void> = {
  downloadProfile,
  clearProfile,
};
