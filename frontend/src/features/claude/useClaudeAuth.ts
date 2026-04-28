import { useCallback, useEffect, useState } from "react";
import { ClearApiKey, GetStatus, SaveApiKey } from "../../../wailsjs/go/main/Claude";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

export type ClaudeStatus = {
  configured: boolean;
  masked?: string;
  model: string;
};

const initial: ClaudeStatus = { configured: false, model: "claude-opus-4-7" };

/**
 * useClaudeAuth espelha o useSpotifyAuth: status é refetched a cada
 * "claude.changed" emitido pelo backend. A key real nunca trafega pro
 * frontend: GetStatus devolve só configured/masked/model.
 */
export function useClaudeAuth() {
  const [status, setStatus] = useState<ClaudeStatus>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await GetStatus();
      setStatus({
        configured: !!s?.configured,
        masked: s?.masked || undefined,
        model: s?.model || initial.model,
      });
    } catch {
      setStatus(initial);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return EventsOn("claude.changed", () => void refresh());
  }, [refresh]);

  const save = useCallback(async (apiKey: string, validate: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const s = await SaveApiKey(apiKey, validate);
      setStatus({
        configured: !!s?.configured,
        masked: s?.masked || undefined,
        model: s?.model || initial.model,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      await ClearApiKey();
    } finally {
      setStatus(initial);
    }
  }, []);

  return { ...status, saving, error, save, disconnect, refresh };
}
