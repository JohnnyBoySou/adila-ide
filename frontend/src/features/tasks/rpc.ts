import { List, Run, SetWorkdir } from "../../../wailsjs/go/main/Tasks";
import { on } from "@/rpc/core";
import type { TaskDef } from "./types";

export const tasksRpc = {
  list: () => List() as Promise<TaskDef[]>,
  run: (id: string) => Run(id) as Promise<string>,
  setWorkdir: (path: string) => SetWorkdir(path),
  on,
};
