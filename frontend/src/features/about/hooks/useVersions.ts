import { useEffect, useState } from "react";
import { rpc } from "../rpc";
import type { VersionMeta } from "../types";

export function useVersions(): {
  versions: VersionMeta[];
  loading: boolean;
} {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void rpc
      .listVersions()
      .then((v) => {
        if (!cancelled) {
          setVersions(v);
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
  }, []);
  return { versions, loading };
}
