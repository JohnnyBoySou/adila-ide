import { useCallback, useEffect, useState } from "react";
import { Connect, Disconnect, GetAccessToken, IsConnected } from "../../../wailsjs/go/main/Spotify";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

type AuthState = {
  connected: boolean;
  connecting: boolean;
  error: string | null;
};

const initial: AuthState = { connected: false, connecting: false, error: null };

export function useSpotifyAuth() {
  const [state, setState] = useState<AuthState>(initial);

  const refresh = useCallback(async () => {
    try {
      const c = await IsConnected();
      setState((s) => ({ ...s, connected: !!c }));
    } catch {
      setState((s) => ({ ...s, connected: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
    return EventsOn("spotify.changed", () => void refresh());
  }, [refresh]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      await Connect();
      setState({ connected: true, connecting: false, error: null });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ connected: false, connecting: false, error: msg });
      throw e;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await Disconnect();
    } finally {
      setState({ connected: false, connecting: false, error: null });
    }
  }, []);

  const getToken = useCallback(async () => {
    return await GetAccessToken();
  }, []);

  return { ...state, connect, disconnect, getToken, refresh };
}
