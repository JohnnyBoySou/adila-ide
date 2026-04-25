import { useEffect, useState } from "react";
import type { UpdateState } from "../types";
import { VersionDropdown } from "./VersionDropdown";
import { MarkdownView } from "./MarkdownView";
import { useVersions } from "../hooks/useVersions";
import { useReleaseNotes } from "../hooks/useReleaseNotes";
import { rpc } from "../rpc";
import { Button } from "@/components/ui/button";

type ReleaseNotesProps = {
  updateState: UpdateState | undefined;
};

export function ReleaseNotes({ updateState }: ReleaseNotesProps) {
  const { versions, loading } = useVersions();
  const [selected, setSelected] = useState<string | undefined>();

  useEffect(() => {
    if (!selected && versions.length > 0) {
      const current = versions.find((v) => v.isCurrent) ?? versions[0];
      setSelected(current.version);
    }
  }, [versions, selected]);

  const { notes, error } = useReleaseNotes(selected);

  if (loading) {
    return <div className="p-6 opacity-60">Loading versions…</div>;
  }

  return (
    <section className="flex-1 flex flex-col min-h-0">
      {updateState?.type === "ready" && (
        <div
          className="flex items-center gap-3 px-6 py-2"
          style={{
            background: "var(--vscode-editorInfo-background)",
            color: "var(--vscode-editorInfo-foreground)",
            borderBottom: "1px solid var(--vscode-widget-border)",
          }}
        >
          <span>Update ready — restart now to install v{updateState.version}</span>
          <div className="flex-1" />
          <Button size="sm" onClick={() => void rpc.restartForUpdate()}>
            Restart
          </Button>
        </div>
      )}
      {versions.length === 0 ? (
        <div className="p-6">
          <h2 className="text-base font-semibold mb-2">No release notes yet</h2>
          <p style={{ color: "var(--vscode-descriptionForeground)" }}>
            Once release notes are published, they'll appear here.
          </p>
        </div>
      ) : (
        <>
          <div
            className="flex items-center gap-3 px-6 py-3 border-b"
            style={{ borderColor: "var(--vscode-widget-border)" }}
          >
            <h2 className="text-base font-semibold">What's new</h2>
            <div className="flex-1" />
            <VersionDropdown versions={versions} selected={selected} onChange={setSelected} />
          </div>
          <div className="flex-1 px-6 py-4 overflow-auto">
            {error && (
              <div
                className="p-4 rounded mb-4"
                style={{
                  background: "var(--vscode-inputValidation-errorBackground)",
                  color: "var(--vscode-inputValidation-errorForeground)",
                  border: "1px solid var(--vscode-inputValidation-errorBorder)",
                }}
              >
                Failed to load: {error}
              </div>
            )}
            {notes === null && (
              <div>
                <h3 className="text-base font-semibold mb-2">
                  Release notes for {selected} not available yet
                </h3>
                <p className="mb-3" style={{ color: "var(--vscode-descriptionForeground)" }}>
                  This version hasn't been documented. Track progress on GitHub.
                </p>
              </div>
            )}
            {notes && <MarkdownView markdown={notes.markdown} />}
          </div>
        </>
      )}
    </section>
  );
}
