export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "conflicted";

export interface GitChangedFile {
  path: string;
  prevPath?: string;
  status: GitFileStatus;
  staged: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStash {
  index: number;
  message: string;
  date: string;
}

export interface GitRemote {
  name: string;
  url: string;
}

export interface GitGraphNode {
  hash: string;
  short: string;
  parents: string[];
  refs: string[];
  subject: string;
  author: string;
  date: string;
  ts: number;
}
