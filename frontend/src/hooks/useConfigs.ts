import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "@/rpc/core";

/**
 * Versão batch de useConfig: carrega N chaves em paralelo e dispara um
 * único re-render quando todas resolvem (em vez de N hooks com N re-renders).
 *
 * Use quando um mesmo componente lê várias configs no mount — boot do App,
 * por exemplo. Para uma única chave, prefira useConfig.
 */
export function useConfigs<T extends Record<string, unknown>>(defaults: T) {
  const defaultsRef = useRef(defaults);
  const [values, setValues] = useState<T>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(defaultsRef.current) as (keyof T)[];
    Promise.all(
      keys.map((k) =>
        call<unknown>("config.get", {
          key: k as string,
          defaultValue: defaultsRef.current[k],
        }).then((v) => [k, v ?? defaultsRef.current[k]] as const),
      ),
    )
      .then((entries) => {
        if (cancelled) return;
        const next = { ...defaultsRef.current };
        for (const [k, v] of entries) {
          (next as Record<string, unknown>)[k as string] = v;
        }
        setValues(next as T);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = useCallback(<K extends keyof T>(key: K, next: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: next }));
    return call<void>("config.set", { key: key as string, value: next });
  }, []);

  return { values, set, loading };
}
