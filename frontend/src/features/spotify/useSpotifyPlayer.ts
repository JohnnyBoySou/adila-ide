import { useCallback, useEffect, useRef, useState } from "react";
import { spotifyApi, type SpotifyDevice, type SpotifyTrackInfo } from "./api";

export type PlayerState = {
  ready: boolean;
  devices: SpotifyDevice[];
  activeDeviceId: string | null;
  paused: boolean;
  position: number;
  duration: number;
  trackUri: string | null;
  trackName: string;
  artistName: string;
  albumArt: string | null;
  contextUri: string | null;
  contextType: string | null;
  queue: SpotifyTrackInfo[];
  error: string | null;
};

const initial: PlayerState = {
  ready: false,
  devices: [],
  activeDeviceId: null,
  paused: true,
  position: 0,
  duration: 0,
  trackUri: null,
  trackName: "",
  artistName: "",
  albumArt: null,
  contextUri: null,
  contextType: null,
  queue: [],
  error: null,
};

const POLL_MS = 4000;

export function useSpotifyPlayer(opts: { enabled: boolean; getToken: () => Promise<string> }) {
  const { enabled, getToken } = opts;
  const [state, setState] = useState<PlayerState>(initial);
  const tokenRef = useRef(getToken);
  useEffect(() => {
    tokenRef.current = getToken;
  });

  const refresh = useCallback(async () => {
    try {
      const t = await tokenRef.current();
      const [pb, devs, q] = await Promise.all([
        spotifyApi.playback(t).catch(() => null),
        spotifyApi.devices(t).catch(() => [] as SpotifyDevice[]),
        spotifyApi.queue(t).catch(() => ({ currently_playing: null, queue: [] as SpotifyTrackInfo[] })),
      ]);
      setState((s) => {
        const active = devs.find((d) => d.is_active) ?? null;
        if (!pb) {
          return {
            ...s,
            ready: devs.length > 0,
            devices: devs,
            activeDeviceId: active?.id ?? null,
            paused: true,
            position: 0,
            duration: 0,
            trackUri: null,
            trackName: "",
            artistName: "",
            albumArt: null,
            contextUri: null,
            contextType: null,
            queue: q.queue ?? [],
            error: null,
          };
        }
        const tr = pb.item;
        return {
          ...s,
          ready: true,
          devices: devs,
          activeDeviceId: pb.device?.id ?? active?.id ?? null,
          paused: !pb.is_playing,
          position: pb.progress_ms ?? 0,
          duration: tr?.duration_ms ?? 0,
          trackUri: tr?.uri ?? null,
          trackName: tr?.name ?? "",
          artistName: tr?.artists?.map((a) => a.name).join(", ") ?? "",
          albumArt: tr?.album?.images?.[0]?.url ?? null,
          contextUri: pb.context?.uri ?? null,
          contextType: pb.context?.type ?? null,
          queue: q.queue ?? [],
          error: null,
        };
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: msg }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState(initial);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refresh();
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    // tick local de posição para suavizar entre polls
    const localId = setInterval(() => {
      setState((s) => {
        if (s.paused || !s.duration) return s;
        const next = Math.min(s.position + 1000, s.duration);
        return { ...s, position: next };
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(localId);
    };
  }, [enabled, refresh]);

  const withToken = useCallback(
    async (fn: (t: string) => Promise<void>) => {
      try {
        const t = await tokenRef.current();
        await fn(t);
        // refresh logo após ação para feedback rápido
        setTimeout(() => void refresh(), 250);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, error: msg }));
      }
    },
    [refresh],
  );

  const togglePlay = useCallback(() => {
    void withToken(async (t) => {
      const dev = state.activeDeviceId;
      if (state.paused) await spotifyApi.play(t, dev);
      else await spotifyApi.pause(t, dev);
    });
  }, [withToken, state.paused, state.activeDeviceId]);

  const nextTrack = useCallback(() => {
    void withToken((t) => spotifyApi.next(t, state.activeDeviceId));
  }, [withToken, state.activeDeviceId]);

  const previousTrack = useCallback(() => {
    void withToken((t) => spotifyApi.previous(t, state.activeDeviceId));
  }, [withToken, state.activeDeviceId]);

  const seek = useCallback(
    (ms: number) => {
      void withToken((t) => spotifyApi.seek(t, ms, state.activeDeviceId));
    },
    [withToken, state.activeDeviceId],
  );

  const setVolume = useCallback(
    (v: number) => {
      void withToken((t) => spotifyApi.setVolume(t, v * 100, state.activeDeviceId));
    },
    [withToken, state.activeDeviceId],
  );

  const transferTo = useCallback(
    (deviceId: string, play = true) => {
      void withToken((t) => spotifyApi.transferPlayback(t, deviceId, play));
    },
    [withToken],
  );

  return {
    ...state,
    deviceId: state.activeDeviceId,
    togglePlay,
    nextTrack,
    previousTrack,
    seek,
    setVolume,
    transferTo,
    refresh,
  };
}
