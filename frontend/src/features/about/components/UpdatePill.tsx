import { Button } from "@/components/ui/button";
import { rpc } from "../rpc";
import type { UpdateState } from "../types";

type UpdatePillProps = {
  state: UpdateState | undefined;
};

export function UpdatePill({ state }: UpdatePillProps) {
  if (!state) {
    return (
      <Button variant="ghost" size="sm" disabled>
        Loading…
      </Button>
    );
  }
  switch (state.type) {
    case "uninitialized":
      return (
        <Button variant="ghost" size="sm" disabled>
          Loading…
        </Button>
      );
    case "disabled":
      return (
        <Button variant="ghost" size="sm" disabled title={state.reason}>
          Updates disabled
        </Button>
      );
    case "idle":
      return (
        <Button size="sm" onClick={() => void rpc.checkForUpdates()}>
          {state.error ? "Retry check" : "Check for updates"}
        </Button>
      );
    case "checking":
      return (
        <Button variant="secondary" size="sm" disabled>
          Checking…
        </Button>
      );
    case "available":
      return (
        <Button size="sm" onClick={() => void rpc.downloadUpdate()}>
          Download v{state.version}
        </Button>
      );
    case "downloading":
      return (
        <Button variant="secondary" size="sm" disabled>
          Downloading
          {typeof state.percent === "number" ? ` ${state.percent}%` : "…"}
        </Button>
      );
    case "downloaded":
      return (
        <Button size="sm" onClick={() => void rpc.applyUpdate()}>
          Install v{state.version}
        </Button>
      );
    case "updating":
      return (
        <Button variant="secondary" size="sm" disabled>
          Installing…
        </Button>
      );
    case "ready":
      return (
        <Button
          size="sm"
          onClick={() => void rpc.restartForUpdate()}
          style={{
            background: "var(--vscode-button-background)",
            color: "var(--vscode-button-foreground)",
          }}
        >
          Restart to update
        </Button>
      );
    case "restarting":
      return (
        <Button variant="ghost" size="sm" disabled>
          Restarting…
        </Button>
      );
  }
}
