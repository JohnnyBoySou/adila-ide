import { useEffect, useState } from "react";
import { rpc } from "../rpc";
import type { ReleaseNotesPayload } from "../types";

export function useReleaseNotes(version: string | undefined): {
  notes: ReleaseNotesPayload | null | undefined;
  error: string | undefined;
} {
  const [notes, setNotes] = useState<ReleaseNotesPayload | null | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!version) {
      setNotes(undefined);
      return;
    }
    let cancelled = false;
    setError(undefined);
    setNotes(undefined);
    void rpc
      .getReleaseNotes(version)
      .then((n) => {
        if (!cancelled) {
          setNotes(n);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return { notes, error };
}
