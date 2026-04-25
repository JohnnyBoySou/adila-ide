import { useCallback, useEffect, useState } from "react";
import { call } from "@/rpc/core";

export function useConfig<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    call<T>("config.get", { key, defaultValue })
      .then((v) => {
        if (!cancelled) {
          setValue((v ?? defaultValue) as T);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, defaultValue]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      return call<void>("config.set", { key, value: next });
    },
    [key],
  );

  const reset = useCallback(
    () =>
      call<void>("config.reset", { key }).then(() => {
        setValue(defaultValue);
      }),
    [key, defaultValue],
  );

  return { value, set, reset, loading, error };
}
