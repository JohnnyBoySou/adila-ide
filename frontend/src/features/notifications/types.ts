export type Severity = "info" | "warning" | "error";

export interface Action {
  index: number;
  label: string;
  enabled: boolean;
}

export interface NotificationItem {
  id: string;
  severity: Severity;
  message: string;
  source: string | undefined;
  sticky: boolean;
  silent: boolean;
  expanded: boolean;
  primaryActions: Action[];
  secondaryActions: Action[];
  progress?: {
    infinite?: boolean;
    total?: number;
    worked?: number;
    done?: boolean;
  };
}

export type LayoutMode = "idle" | "toasts" | "center";
