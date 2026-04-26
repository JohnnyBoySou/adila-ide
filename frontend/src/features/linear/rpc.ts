import {
  GetClientID,
  GetMe,
  GetMyIssues,
  IsAuthenticated,
  Logout,
  SetClientID,
  StartOAuth,
} from "../../../wailsjs/go/main/Linear";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import type { main } from "../../../wailsjs/go/models";

export type LinearUser = main.LinearUser;
export type LinearIssue = main.LinearIssue;
export type LinearState = main.LinearState;
export type LinearTeam = main.LinearTeam;
export type LinearProject = main.LinearProject;

export const linearRpc = {
  isAuthenticated: () => IsAuthenticated() as Promise<boolean>,
  startOAuth: () => StartOAuth() as Promise<void>,
  logout: () => Logout() as Promise<void>,
  getMe: () => GetMe() as Promise<LinearUser>,
  getMyIssues: () => GetMyIssues() as Promise<LinearIssue[]>,
  getClientId: () => GetClientID() as Promise<string>,
  setClientId: (id: string) => SetClientID(id) as Promise<void>,
  onAuthed: (cb: () => void) => EventsOn("linear.authed", cb),
};
