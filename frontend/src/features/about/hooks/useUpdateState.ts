import { useEffect, useState } from "react";
import { rpc } from "../rpc";
import type { UpdateState } from "../types";

export function useUpdateState(): UpdateState | undefined {
  const [state, setState] = useState<UpdateState | undefined>();

  useEffect(() => {
    let cancelled = false;
    void rpc.getUpdateState().then((s) => {
      if (!cancelled) {
        setState(s);
      }
    });
    const off = rpc.onUpdateState((s) => {
      if (!cancelled) {
        setState(s);
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return state;
}
