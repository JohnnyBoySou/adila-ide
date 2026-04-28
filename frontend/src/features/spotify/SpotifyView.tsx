import {
  ArrowLeft,
  Heart,
  ListMusic,
  ListOrdered,
  LogOut,
  Monitor,
  Music,
  Pause,
  Play,
  RefreshCw,
  Smartphone,
  SkipBack,
  SkipForward,
  Speaker,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  spotifyApi,
  type SpotifyDevice,
  type SpotifyMe,
  type SpotifyPlaylist,
  type SpotifyTrackInfo,
} from "./api";
import { SpotifyConnect } from "./SpotifyConnect";
import { useSpotifyAuth } from "./useSpotifyAuth";
import { useSpotifyPlayer } from "./useSpotifyPlayer";

function formatTime(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function deviceIcon(d: SpotifyDevice) {
  const t = d.type.toLowerCase();
  if (t === "smartphone") return <Smartphone className="size-3.5" />;
  if (t === "speaker") return <Speaker className="size-3.5" />;
  return <Monitor className="size-3.5" />;
}

type Tab = "queue" | "playlists";

type Props = {
  overlayOpen: boolean;
  onClose: () => void;
};

export function SpotifyView({ overlayOpen, onClose }: Props) {
  const {
    connected,
    connecting,
    error: authError,
    connect,
    disconnect,
    getToken,
  } = useSpotifyAuth();
  const player = useSpotifyPlayer({ enabled: connected, getToken });

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [tab, setTab] = useState<Tab>("queue");
  const [openedPlaylist, setOpenedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrackInfo[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [me, setMe] = useState<SpotifyMe | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [connectOpen, setConnectOpen] = useState(false);
  const prevBtnRef = useRef<HTMLButtonElement | null>(null);
  const nextBtnRef = useRef<HTMLButtonElement | null>(null);

  const spawnRipple = useCallback((x: number, y: number) => {
    const id = Date.now() + Math.random();
    setRipples((rs) => [...rs, { id, x, y }]);
    setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), 900);
  }, []);

  const triggerNext = useCallback(() => {
    const r = nextBtnRef.current?.getBoundingClientRect();
    if (r) spawnRipple(r.left + r.width / 2, r.top + r.height / 2);
    player.nextTrack();
  }, [player, spawnRipple]);

  const triggerPrev = useCallback(() => {
    const r = prevBtnRef.current?.getBoundingClientRect();
    if (r) spawnRipple(r.left + r.width / 2, r.top + r.height / 2);
    player.previousTrack();
  }, [player, spawnRipple]);

  const trackId = useMemo(() => {
    const uri = player.trackUri;
    if (!uri) return null;
    const prefix = "spotify:track:";
    return uri.startsWith(prefix) ? uri.slice(prefix.length) : null;
  }, [player.trackUri]);

  useEffect(() => {
    if (!connected) {
      setMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const t = await getToken();
        const profile = await spotifyApi.me(t);
        if (!cancelled) setMe(profile);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, getToken]);

  useEffect(() => {
    if (!connected || !trackId) {
      setIsLiked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const t = await getToken();
        const r = await spotifyApi.isTrackSaved(t, [trackId]);
        if (!cancelled) setIsLiked(!!r[0]);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, trackId, getToken]);

  const toggleLike = useCallback(async () => {
    if (!trackId || likePending) return;
    setLikePending(true);
    const was = isLiked;
    setIsLiked(!was);
    try {
      const t = await getToken();
      if (was) await spotifyApi.removeTracks(t, [trackId]);
      else await spotifyApi.saveTracks(t, [trackId]);
    } catch (e) {
      setIsLiked(was);
      console.error("spotify like:", e);
    } finally {
      setLikePending(false);
    }
  }, [trackId, isLiked, likePending, getToken]);

  useEffect(() => {
    if (!connected || playlists.length > 0) return;
    setLoadingPlaylists(true);
    (async () => {
      try {
        const t = await getToken();
        const page = await spotifyApi.myPlaylists(t);
        setPlaylists(page.items.filter(Boolean));
      } catch {
        /* silencioso */
      } finally {
        setLoadingPlaylists(false);
      }
    })();
  }, [connected, playlists.length, getToken]);

  useEffect(() => {
    if (!openedPlaylist) {
      setTracks([]);
      return;
    }
    setLoadingTracks(true);
    (async () => {
      try {
        const t = await getToken();
        const page = await spotifyApi.playlistTracks(t, openedPlaylist.id);
        setTracks(page.items.map((it) => it.track).filter((x): x is SpotifyTrackInfo => !!x));
      } catch {
        setTracks([]);
      } finally {
        setLoadingTracks(false);
      }
    })();
  }, [openedPlaylist, getToken]);

  useEffect(() => {
    if (!overlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const meta = e.ctrlKey || e.metaKey;
      if (!meta || e.altKey || e.shiftKey) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        triggerNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        triggerPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlayOpen, onClose, triggerNext, triggerPrev]);

  const ensureDevice = useCallback(async (): Promise<string | null> => {
    const dev = player.activeDeviceId ?? player.devices[0]?.id ?? null;
    if (!dev) return null;
    if (!player.activeDeviceId) {
      const t = await getToken();
      await spotifyApi.transferPlayback(t, dev, false);
    }
    return dev;
  }, [player.activeDeviceId, player.devices, getToken]);

  const onPlayPlaylist = useCallback(
    async (p: SpotifyPlaylist) => {
      try {
        const dev = await ensureDevice();
        if (!dev) return;
        const t = await getToken();
        await spotifyApi.playContext(t, dev, p.uri);
        setTimeout(() => void player.refresh(), 400);
      } catch (e) {
        console.error("spotify play context:", e);
      }
    },
    [ensureDevice, getToken, player],
  );

  const onPlayTrackInPlaylist = useCallback(
    async (track: SpotifyTrackInfo, playlist: SpotifyPlaylist) => {
      try {
        const dev = await ensureDevice();
        if (!dev) return;
        const t = await getToken();
        await spotifyApi.playContextAt(t, dev, playlist.uri, track.uri);
        setTimeout(() => void player.refresh(), 400);
      } catch (e) {
        console.error("spotify play track in context:", e);
      }
    },
    [ensureDevice, getToken, player],
  );

  const onPlayQueueTrack = useCallback(
    async (track: SpotifyTrackInfo) => {
      try {
        const dev = await ensureDevice();
        if (!dev) return;
        const t = await getToken();
        // se a fila vem de um contexto (ex: playlist atual), preserva o contexto.
        if (player.contextUri) {
          await spotifyApi.playContextAt(t, dev, player.contextUri, track.uri);
        } else {
          await spotifyApi.playUris(t, dev, [track.uri]);
        }
        setTimeout(() => void player.refresh(), 400);
      } catch (e) {
        console.error("spotify play queue track:", e);
      }
    },
    [ensureDevice, getToken, player],
  );

  if (!overlayOpen) return null;

  const hasDevices = player.devices.length > 0;
  const activeDevice = player.devices.find((d) => d.id === player.activeDeviceId) ?? null;
  const currentPlaylist =
    player.contextType === "playlist" && player.contextUri
      ? (playlists.find((p) => p.uri === player.contextUri) ?? null)
      : null;

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col overflow-hidden">
      {/* Ripples — passam por cima do conteúdo (z-50) sem bloquear cliques */}
      <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
        {ripples.map((r) => (
          <span
            key={r.id}
            className="absolute rounded-full bg-green-500"
            style={{
              left: r.x,
              top: r.y,
              width: 16,
              height: 16,
              animation: "spotify-ripple 900ms ease-out forwards",
            }}
          />
        ))}
      </div>
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Music className="size-4 text-green-500" />
          Spotify
          {connected && me && (
            <span className="inline-flex items-center gap-1.5 pl-1">
              {me.images?.[0]?.url ? (
                <img
                  src={me.images[0].url}
                  alt={me.display_name}
                  className="size-5 rounded-full object-cover ring-1 ring-border"
                />
              ) : (
                <span className="size-5 rounded-full bg-accent inline-flex items-center justify-center text-[9px] font-semibold uppercase">
                  {me.display_name?.[0] ?? "?"}
                </span>
              )}
              <span className="text-xs font-normal">{me.display_name}</span>
              {me.product === "premium" && (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-green-500 bg-green-500/10 border border-green-500/20 rounded px-1 py-px">
                  Premium
                </span>
              )}
            </span>
          )}
          {connected && activeDevice && (
            <span className="text-[11px] text-muted-foreground font-normal inline-flex items-center gap-1">
              · {deviceIcon(activeDevice)} {activeDevice.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {connected && (
            <>
              <button
                type="button"
                onClick={() => void player.refresh()}
                title="Atualizar"
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150 active:scale-90"
              >
                <RefreshCw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void disconnect()}
                title="Desconectar"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-all duration-150 active:scale-95"
              >
                <LogOut className="size-3.5" />
                Desconectar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar (Esc)"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150 active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {!connected ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-sm text-center flex flex-col items-center gap-4">
            <div className="size-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <Music className="size-7 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Conecte sua conta Spotify</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Controle a reprodução do seu Spotify (desktop, celular, web) direto do editor.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConnectOpen(true)}
              disabled={connecting}
              className="rounded-full bg-green-600 hover:bg-green-500 disabled:opacity-50 px-6 py-2 text-sm font-medium text-white cursor-pointer transition-all duration-150 active:scale-95 hover:scale-105"
            >
              {connecting ? "Aguardando navegador…" : "Conectar com Spotify"}
            </button>
            {authError && <p className="text-xs text-destructive">{authError}</p>}
          </div>
        </div>
      ) : !hasDevices ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center flex flex-col items-center gap-3">
            <div className="size-14 rounded-full bg-muted flex items-center justify-center">
              <Speaker className="size-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-semibold">Nenhum device ativo</h2>
            <p className="text-sm text-muted-foreground">
              Abra o Spotify no desktop, no celular ou em{" "}
              <span className="text-foreground">open.spotify.com</span> e clique em "Atualizar".
            </p>
            <button
              type="button"
              onClick={() => void player.refresh()}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent cursor-pointer transition-all duration-150 active:scale-95"
            >
              <RefreshCw className="size-3.5" />
              Atualizar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[minmax(0,1fr)_360px] min-h-0">
          {/* Now-playing */}
          <div className="flex flex-col items-center justify-center px-8 gap-5 min-h-0">
            <div className="group relative size-80 flex items-center justify-center">
              {/* Disco de vinil — gira só quando tocando, desliza pra direita ao hover na capa */}
              <div
                className="absolute inset-0 rounded-full shadow-2xl transition-transform duration-500 ease-out group-hover:translate-x-24"
                style={{
                  background:
                    "repeating-radial-gradient(circle, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 5px), radial-gradient(circle, #1f1f1f 0%, #050505 100%)",
                  animation:
                    !player.paused && player.trackName ? "spin 8s linear infinite" : undefined,
                }}
              >
                {/* Brilho oblíquo */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)",
                  }}
                />
                {/* Label central */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-20 rounded-full bg-green-600 flex items-center justify-center overflow-hidden">
                  {player.albumArt ? (
                    <img
                      src={player.albumArt}
                      alt=""
                      className="size-full object-cover opacity-70"
                    />
                  ) : null}
                  <div className="absolute size-2 rounded-full bg-black ring-1 ring-white/20" />
                </div>
              </div>
              {/* Capa do álbum sobre o disco */}
              <div className="relative size-64 rounded-lg bg-muted overflow-hidden flex items-center justify-center shadow-2xl">
                {player.albumArt ? (
                  <img src={player.albumArt} alt="" className="size-full object-cover" />
                ) : (
                  <Music className="size-16 text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="text-center max-w-md">
              <div className="text-xl font-semibold truncate">
                {player.trackName || "Selecione uma playlist"}
              </div>
              <div className="text-sm text-muted-foreground truncate mt-1">
                {player.artistName || "—"}
              </div>
              {currentPlaylist && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenedPlaylist(currentPlaylist);
                    setTab("playlists");
                  }}
                  className="mt-2 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ListMusic className="size-3" />
                  de {currentPlaylist.name}
                </button>
              )}
            </div>

            <div className="w-full max-w-md">
              <input
                type="range"
                min={0}
                max={Math.max(1, player.duration)}
                value={player.position}
                onChange={(e) => player.seek(Number(e.target.value))}
                disabled={!player.duration}
                className="w-full h-1 cursor-pointer accent-green-500"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums mt-1">
                <span>{formatTime(player.position)}</span>
                <span>{formatTime(player.duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void toggleLike()}
                disabled={!trackId || likePending}
                title={isLiked ? "Remover de Curtidas" : "Salvar em Curtidas"}
                className={
                  "p-2 rounded-full hover:bg-accent disabled:opacity-40 cursor-pointer transition-all duration-150 active:scale-90 " +
                  (isLiked ? "text-green-500" : "text-muted-foreground hover:text-foreground")
                }
              >
                <Heart className={"size-5 transition-all " + (isLiked ? "fill-green-500" : "")} />
              </button>
              <button
                ref={prevBtnRef}
                type="button"
                onClick={triggerPrev}
                disabled={!player.activeDeviceId}
                title="Anterior (Ctrl+←)"
                className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer transition-all duration-150 active:scale-90"
              >
                <SkipBack className="size-5" />
              </button>
              <button
                type="button"
                onClick={player.togglePlay}
                disabled={!player.activeDeviceId}
                className="p-3 rounded-full bg-foreground text-background hover:opacity-90 disabled:opacity-40 cursor-pointer transition-all duration-150 active:scale-90 hover:scale-105"
              >
                {player.paused ? <Play className="size-5" /> : <Pause className="size-5" />}
              </button>
              <button
                ref={nextBtnRef}
                type="button"
                onClick={triggerNext}
                disabled={!player.activeDeviceId}
                title="Próxima (Ctrl+→)"
                className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer transition-all duration-150 active:scale-90"
              >
                <SkipForward className="size-5" />
              </button>
            </div>

            <div className="flex items-center gap-2 w-48">
              <Volume2 className="size-4 text-muted-foreground" />
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={activeDevice?.volume_percent ?? 50}
                key={activeDevice?.id ?? "none"}
                onChange={(e) => player.setVolume(Number(e.target.value) / 100)}
                className="flex-1 h-1 cursor-pointer accent-green-500"
                title="Volume"
              />
            </div>
          </div>

          {/* Sidebar */}
          <aside className="border-l flex flex-col min-h-0">
            {/* Devices */}
            <div className="px-3 py-2 border-b">
              <div className="text-[10px] font-medium uppercase text-muted-foreground tracking-wide mb-1.5">
                Devices
              </div>
              <ul className="flex flex-col gap-0.5">
                {player.devices.map((d) => (
                  <li key={d.id ?? d.name}>
                    <button
                      type="button"
                      onClick={() => d.id && player.transferTo(d.id)}
                      disabled={!d.id || d.is_active}
                      className={
                        "w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors duration-150 disabled:cursor-default " +
                        (d.is_active
                          ? "bg-green-500/10 text-green-600"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer active:scale-[0.98]")
                      }
                    >
                      {deviceIcon(d)}
                      <span className="truncate">{d.name}</span>
                      {d.is_active && <span className="ml-auto text-[10px]">ativo</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tabs */}
            <div className="flex border-b text-xs shrink-0">
              <button
                type="button"
                onClick={() => setTab("queue")}
                className={
                  "flex-1 px-3 py-2 inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer " +
                  (tab === "queue"
                    ? "border-green-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <ListOrdered className="size-3.5" />
                Fila
                {player.queue.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">({player.queue.length})</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setTab("playlists")}
                className={
                  "flex-1 px-3 py-2 inline-flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer " +
                  (tab === "playlists"
                    ? "border-green-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <ListMusic className="size-3.5" />
                Playlists
              </button>
            </div>

            {/* Tab content — cada lista cuida do próprio scroll virtualizado */}
            <div className="flex-1 min-h-0">
              {tab === "queue" ? (
                <QueueList
                  currentUri={player.trackUri}
                  queue={player.queue}
                  onPlay={onPlayQueueTrack}
                />
              ) : openedPlaylist ? (
                <PlaylistTracks
                  playlist={openedPlaylist}
                  tracks={tracks}
                  loading={loadingTracks}
                  currentUri={player.trackUri}
                  onBack={() => setOpenedPlaylist(null)}
                  onPlayAll={() => void onPlayPlaylist(openedPlaylist)}
                  onPlayTrack={(t) => void onPlayTrackInPlaylist(t, openedPlaylist)}
                />
              ) : (
                <PlaylistsList
                  playlists={playlists}
                  loading={loadingPlaylists}
                  currentContextUri={player.contextUri}
                  onOpen={(p) => setOpenedPlaylist(p)}
                  onPlay={(p) => void onPlayPlaylist(p)}
                />
              )}
            </div>
          </aside>
        </div>
      )}

      <SpotifyConnect open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}

function QueueList({
  currentUri,
  queue,
  onPlay,
}: {
  currentUri: string | null;
  queue: SpotifyTrackInfo[];
  onPlay: (t: SpotifyTrackInfo) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const v = useVirtualizer({
    count: queue.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  if (queue.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Fila vazia. Toque uma playlist ou adicione faixas.
      </div>
    );
  }
  return (
    <div ref={parentRef} className="h-full overflow-y-auto scrollbar">
      <div style={{ height: `${v.getTotalSize()}px`, position: "relative", width: "100%" }}>
        {v.getVirtualItems().map((vr) => {
          const t = queue[vr.index];
          return (
            <div
              key={vr.key}
              data-index={vr.index}
              ref={v.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start}px)`,
              }}
            >
              <TrackRow
                track={t}
                active={t.uri === currentUri}
                index={vr.index + 1}
                onPlay={() => onPlay(t)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaylistsList({
  playlists,
  loading,
  currentContextUri,
  onOpen,
  onPlay,
}: {
  playlists: SpotifyPlaylist[];
  loading: boolean;
  currentContextUri: string | null;
  onOpen: (p: SpotifyPlaylist) => void;
  onPlay: (p: SpotifyPlaylist) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const v = useVirtualizer({
    count: playlists.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 6,
  });

  if (loading)
    return <div className="p-4 text-xs text-muted-foreground">Carregando playlists…</div>;
  if (playlists.length === 0)
    return <div className="p-4 text-xs text-muted-foreground">Nenhuma playlist.</div>;
  return (
    <div ref={parentRef} className="h-full overflow-y-auto scrollbar">
      <div style={{ height: `${v.getTotalSize()}px`, position: "relative", width: "100%" }}>
        {v.getVirtualItems().map((vr) => {
          const p = playlists[vr.index];
          const active = p.uri === currentContextUri;
          return (
            <div
              key={vr.key}
              data-index={vr.index}
              ref={v.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start}px)`,
              }}
            >
              <div
                className={
                  "group w-full flex items-center gap-2 px-3 py-2 hover:bg-accent " +
                  (active ? "bg-green-500/5" : "")
                }
              >
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <div className="size-10 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                    {p.images?.[0]?.url ? (
                      <img
                        src={p.images[0].url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Music className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={"text-xs truncate " + (active ? "text-green-600 font-medium" : "")}
                    >
                      {p.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {p.tracks.total} faixas · {p.owner.display_name}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onPlay(p)}
                  title="Tocar"
                  className="p-1.5 rounded-full bg-green-600 text-white opacity-0 group-hover:opacity-100 hover:bg-green-500 cursor-pointer transition-all duration-150 active:scale-90 hover:scale-110"
                >
                  <Play className="size-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaylistTracks({
  playlist,
  tracks,
  loading,
  currentUri,
  onBack,
  onPlayAll,
  onPlayTrack,
}: {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrackInfo[];
  loading: boolean;
  currentUri: string | null;
  onBack: () => void;
  onPlayAll: () => void;
  onPlayTrack: (t: SpotifyTrackInfo) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const v = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150 active:scale-90"
          title="Voltar"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{playlist.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {playlist.tracks.total} faixas
          </div>
        </div>
        <button
          type="button"
          onClick={onPlayAll}
          title="Tocar playlist"
          className="p-1.5 rounded-full bg-green-600 text-white hover:bg-green-500 cursor-pointer transition-all duration-150 active:scale-90 hover:scale-110"
        >
          <Play className="size-3" />
        </button>
      </div>
      {loading ? (
        <div className="p-4 text-xs text-muted-foreground">Carregando faixas…</div>
      ) : tracks.length === 0 ? (
        <div className="p-4 text-xs text-muted-foreground">Playlist vazia.</div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto scrollbar min-h-0">
          <div style={{ height: `${v.getTotalSize()}px`, position: "relative", width: "100%" }}>
            {v.getVirtualItems().map((vr) => {
              const t = tracks[vr.index];
              return (
                <div
                  key={vr.key}
                  data-index={vr.index}
                  ref={v.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  <TrackRow
                    track={t}
                    active={t.uri === currentUri}
                    index={vr.index + 1}
                    onPlay={() => onPlayTrack(t)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TrackRow({
  track,
  active,
  index,
  onPlay,
}: {
  track: SpotifyTrackInfo;
  active: boolean;
  index: number;
  onPlay: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={
        "group w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-accent cursor-pointer transition-colors " +
        (active ? "bg-green-500/5" : "")
      }
    >
      <div className="w-6 text-[10px] text-muted-foreground tabular-nums text-right shrink-0 group-hover:hidden">
        {active ? <Music className="size-3 text-green-500 ml-auto" /> : index}
      </div>
      <div className="w-6 hidden group-hover:flex items-center justify-end shrink-0">
        <Play className="size-3 text-foreground" />
      </div>
      <div className="size-8 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
        {track.album?.images?.[0]?.url ? (
          <img
            src={track.album.images[0].url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <Music className="size-3 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className={"text-xs truncate " + (active ? "text-green-600 font-medium" : "")}>
          {track.name}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {track.artists.map((a) => a.name).join(", ")}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
        {formatTime(track.duration_ms)}
      </span>
    </button>
  );
}
