import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "@/rpc/core";

export function useConfig<T>(key: string, defaultValue: T) {
  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    const dv = defaultRef.current;
    call<T>("config.get", { key, defaultValue: dv })
      .then((v) => {
        if (!cancelled) {
          setValue((v ?? defaultRef.current) as T);
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
  }, [key]);

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
        setValue(defaultRef.current);
      }),
    [key],
  );

  return { value, set, reset, loading, error };
}
