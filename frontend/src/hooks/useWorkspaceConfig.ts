import { useCallback, useEffect, useRef, useState } from "react";
import { call, on } from "@/rpc/core";

/**
 * Lê e escreve em <workdir>/.adila/settings.json. Recarrega ao receber o
 * evento "workspaceConfig.changed" (incluindo "key": "*" emitido em troca de
 * workdir). API espelha useConfig — defaultValue precisa ser estável (ref).
 */
export function useWorkspaceConfig<T>(key: string, defaultValue: T) {
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    call<T>("workspaceConfig.get", { key, defaultValue: defaultRef.current })
      .then((v) => {
        if (!cancelled) setValue((v ?? defaultRef.current) as T);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    const cleanup = reload();
    const off = on("workspaceConfig.changed", (payload) => {
      const k = (payload as { key?: string } | undefined)?.key;
      if (k === key || k === "*") reload();
    });
    return () => {
      cleanup();
      off();
    };
  }, [key, reload]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      return call<void>("workspaceConfig.set", { key, value: next });
    },
    [key],
  );

  const reset = useCallback(
    () =>
      call<void>("workspaceConfig.reset", { key }).then(() => {
        setValue(defaultRef.current);
      }),
    [key],
  );

  return { value, set, reset, loading, error };
}
