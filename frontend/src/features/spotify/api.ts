// Wrapper minimalista para chamadas à Web API do Spotify.
// O token é obtido via Go (refresh transparente).

const BASE = "https://api.spotify.com/v1";

export type SpotifyMe = {
  id: string;
  display_name: string;
  email: string;
  product: "premium" | "free" | "open";
  images?: { url: string }[];
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  uri: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
};

export type SpotifyPlaylistsPage = {
  items: SpotifyPlaylist[];
  total: number;
  next: string | null;
};

export type SpotifyDevice = {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
};

export type SpotifyTrackInfo = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
};

export type SpotifyContext = {
  type: string;
  uri: string;
  href: string;
};

export type SpotifyPlayback = {
  device: SpotifyDevice | null;
  is_playing: boolean;
  progress_ms: number | null;
  item: SpotifyTrackInfo | null;
  context: SpotifyContext | null;
};

export type SpotifyQueue = {
  currently_playing: SpotifyTrackInfo | null;
  queue: SpotifyTrackInfo[];
};

export type SpotifyPlaylistTrack = {
  track: SpotifyTrackInfo | null;
};

export type SpotifyPlaylistTracksPage = {
  items: SpotifyPlaylistTrack[];
  total: number;
  next: string | null;
};

async function getJson<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // 204 No Content (sem playback ativo)
  if (res.status === 204) return null;
  if (!res.ok) {
    throw new Error(`spotify ${path}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function get<T>(path: string, token: string): Promise<T> {
  const v = await getJson<T>(path, token);
  if (v === null) throw new Error(`spotify ${path}: empty body`);
  return v;
}

async function put(path: string, token: string, body?: unknown): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`spotify PUT ${path}: ${res.status} ${await res.text()}`);
  }
}

async function post(path: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`spotify POST ${path}: ${res.status} ${await res.text()}`);
  }
}

async function del(path: string, token: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`spotify DELETE ${path}: ${res.status} ${await res.text()}`);
  }
}

function deviceQuery(deviceId: string | null | undefined): string {
  return deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : "";
}

export const spotifyApi = {
  me: (token: string) => get<SpotifyMe>("/me", token),
  myPlaylists: (token: string, limit = 50) =>
    get<SpotifyPlaylistsPage>(`/me/playlists?limit=${limit}`, token),
  devices: (token: string) =>
    get<{ devices: SpotifyDevice[] }>("/me/player/devices", token).then((r) => r.devices),
  playback: (token: string) => getJson<SpotifyPlayback>("/me/player", token),
  queue: (token: string) => get<SpotifyQueue>("/me/player/queue", token),
  playlistTracks: (token: string, playlistId: string, limit = 100) =>
    get<SpotifyPlaylistTracksPage>(
      `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=${limit}`,
      token,
    ),
  /** Transfere o playback ativo para um deviceId específico. */
  transferPlayback: (token: string, deviceId: string, play = false) =>
    put("/me/player", token, { device_ids: [deviceId], play }),
  /** Toca um context_uri (playlist/album/artista) num device. */
  playContext: (token: string, deviceId: string | null, contextUri: string) =>
    put(`/me/player/play${deviceQuery(deviceId)}`, token, { context_uri: contextUri }),
  /** Toca uma faixa específica dentro de um context_uri (preserva playlist). */
  playContextAt: (token: string, deviceId: string | null, contextUri: string, offsetUri: string) =>
    put(`/me/player/play${deviceQuery(deviceId)}`, token, {
      context_uri: contextUri,
      offset: { uri: offsetUri },
    }),
  /** Toca lista solta de URIs (não preserva contexto). */
  playUris: (token: string, deviceId: string | null, uris: string[]) =>
    put(`/me/player/play${deviceQuery(deviceId)}`, token, { uris }),
  play: (token: string, deviceId?: string | null) =>
    put(`/me/player/play${deviceQuery(deviceId)}`, token),
  pause: (token: string, deviceId?: string | null) =>
    put(`/me/player/pause${deviceQuery(deviceId)}`, token),
  next: (token: string, deviceId?: string | null) =>
    post(`/me/player/next${deviceQuery(deviceId)}`, token),
  previous: (token: string, deviceId?: string | null) =>
    post(`/me/player/previous${deviceQuery(deviceId)}`, token),
  seek: (token: string, positionMs: number, deviceId?: string | null) =>
    put(
      `/me/player/seek?position_ms=${Math.max(0, Math.floor(positionMs))}${
        deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
      }`,
      token,
    ),
  setVolume: (token: string, volumePercent: number, deviceId?: string | null) =>
    put(
      `/me/player/volume?volume_percent=${Math.max(0, Math.min(100, Math.round(volumePercent)))}${
        deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ""
      }`,
      token,
    ),
  /** Verifica se as faixas estão salvas em "Curtidas". */
  isTrackSaved: (token: string, ids: string[]) =>
    get<boolean[]>(`/me/tracks/contains?ids=${ids.map(encodeURIComponent).join(",")}`, token),
  saveTracks: (token: string, ids: string[]) =>
    put(`/me/tracks?ids=${ids.map(encodeURIComponent).join(",")}`, token),
  removeTracks: (token: string, ids: string[]) =>
    del(`/me/tracks?ids=${ids.map(encodeURIComponent).join(",")}`, token),
};
