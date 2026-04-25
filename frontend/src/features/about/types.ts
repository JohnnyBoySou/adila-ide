export type ProductInfo = {
  name: string;
  version: string;
  goVersion: string;
  os: string;
  arch: string;
  repo: string;
  issuesUrl: string;
  licenseUrl: string;
};

export type UpdateState =
  | { type: "idle"; error?: string }
  | { type: "uninitialized" }
  | { type: "disabled"; reason: string }
  | { type: "checking" }
  | { type: "available"; version: string; canInstall: boolean }
  | { type: "downloading"; percent?: number }
  | { type: "downloaded"; version: string }
  | { type: "updating" }
  | { type: "ready"; version: string }
  | { type: "restarting" };

export type VersionMeta = {
  version: string;
  date: string;
  isCurrent: boolean;
};

export type ReleaseNotesPayload = {
  version: string;
  date: string;
  markdown: string;
};
