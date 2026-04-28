import { useCallback, useEffect, useState } from "react";
import { ClearApiKey, GetStatus, SaveApiKey } from "../../../wailsjs/go/main/Codex";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

export type CodexStatus = {
  configured: boolean;
  masked?: string;
  model: string;
};

const initial: CodexStatus = { configured: false, model: "gpt-5-codex" };

/**
 * useCodexAuth espelha o useClaudeAuth mas pra OpenAI. A key real nunca
 * trafega pro frontend: GetStatus devolve só configured/masked/model.
 */
export function useCodexAuth() {
  const [status, setStatus] = useState<CodexStatus>(initial);
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
    return EventsOn("codex.changed", () => void refresh());
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
