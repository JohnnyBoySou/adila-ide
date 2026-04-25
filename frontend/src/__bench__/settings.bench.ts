import { bench, describe } from "vitest";
import { filterGroups, settingsGroups } from "../features/settings/settingsSchema";

describe("settings — filterGroups", () => {
  bench("empty query (passthrough)", () => {
    filterGroups(settingsGroups, "");
  });

  bench("'theme' (broad)", () => {
    filterGroups(settingsGroups, "theme");
  });

  bench("'editor.fontSize' (specific key)", () => {
    filterGroups(settingsGroups, "editor.fontSize");
  });

  bench("'autoSave' (camelCase token)", () => {
    filterGroups(settingsGroups, "autoSave");
  });

  bench("'zzzzzzz' (no match)", () => {
    filterGroups(settingsGroups, "zzzzzzz");
  });

  bench("'a' (matches almost everything)", () => {
    filterGroups(settingsGroups, "a");
  });
});
