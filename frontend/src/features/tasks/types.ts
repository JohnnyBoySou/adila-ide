export type TaskKind = "npm" | "go" | "cargo";

export interface TaskDef {
  id: string;
  kind: TaskKind;
  label: string;
  detail: string;
  command: string;
  cwd: string;
  source: string;
}
