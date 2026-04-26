import { Check, Music } from "lucide-react";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { spotifyApi, type SpotifyMe } from "@/features/spotify/api";
import { useSpotifyAuth } from "@/features/spotify/useSpotifyAuth";
import { cn } from "@/lib/utils";

export function Spotify() {
  const { connected, connecting, error, connect, disconnect, getToken } = useSpotifyAuth();
  const [me, setMe] = useState<SpotifyMe | null>(null);

  useEffect(() => {
    if (!connected) {
      setMe(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const profile = await spotifyApi.me(token);
        if (!cancelled) setMe(profile);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, getToken]);

  const avatar = me?.images?.[0]?.url;

  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-muted/30 shadow-sm">
        <Music className="size-8 text-green-500" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Conectar ao Spotify</h2>
        <p className="text-sm text-muted-foreground">
          Opcional. Permite controlar player, playlists e ver a música tocando direto da IDE.
          Requer conta Premium para play/pause via API.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void (connected ? disconnect() : connect())}
        disabled={connecting}
        className={cn(
          "flex w-full max-w-sm items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors",
          "hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60",
          connected && "border-primary ring-2 ring-primary/30",
        )}
        aria-pressed={connected}
      >
        <div
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border border-border transition-colors",
            connected && "border-primary bg-primary text-primary-foreground",
          )}
        >
          {connecting ? <Spinner size="xs" /> : connected ? <Check className="size-3.5" /> : null}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-medium truncate">
            {connected
              ? me?.display_name
                ? `Conectado como ${me.display_name}`
                : "Conectado ao Spotify"
              : "Conectar conta do Spotify"}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {connecting
              ? "Aguardando autorização no navegador…"
              : connected
                ? me?.product === "premium"
                  ? "Premium · clique para desconectar"
                  : me?.product
                    ? `${me.product} · play/pause requer Premium`
                    : "Clique para desconectar"
                : "Abre o navegador para autorizar via OAuth"}
          </span>
        </div>
        {connected && avatar ? (
          <img
            src={avatar}
            alt={me?.display_name ?? ""}
            className="size-8 rounded-full shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : null}
      </button>

      {error && !connecting && (
        <p className="text-xs text-destructive max-w-sm">{error}</p>
      )}
    </div>
  );
}
