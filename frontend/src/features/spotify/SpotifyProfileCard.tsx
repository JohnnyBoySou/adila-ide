import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { spotifyApi, type SpotifyMe } from "./api";
import { SpotifyConnect } from "./SpotifyConnect";
import { SpotifyIcon } from "./SpotifyIcon";
import { useSpotifyAuth } from "./useSpotifyAuth";

type SpotifyProfileCardProps = {
  onOpen: () => void;
};

export function SpotifyProfileCard({ onOpen }: SpotifyProfileCardProps) {
  const { connected, getToken } = useSpotifyAuth();
  const [profile, setProfile] = useState<SpotifyMe | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    if (!connected) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const me = await spotifyApi.me(token);
        if (!cancelled) setProfile(me);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, getToken]);

  const handleClick = useCallback(() => {
    if (connected) {
      onOpen();
    } else {
      setConnectOpen(true);
    }
  }, [connected, onOpen]);

  const displayName = profile?.display_name || "Spotify";
  const subtitle = profile
    ? profile.product === "premium"
      ? "Conta Premium conectada"
      : "Conta conectada"
    : "Conecte sua conta para controlar sua música.";
  const avatarUrl = profile?.images?.[0]?.url;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "SP";

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        className="group flex flex-row items-center bg-transparent gap-3 p-4 transition-colors cursor-pointer hover:bg-accent/40"
      >
        <Avatar size="lg">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
          <AvatarFallback className="bg-green-500/10 text-[#1DB954]">
            {profile ? initials : <SpotifyIcon className="size-6" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{displayName}</span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {connected ? (
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        ) : (
          <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-full bg-[#1DB954] px-3 py-1 text-xs font-semibold text-black shadow-sm transition-all group-hover:brightness-110"
          >
            Entrar
          </span>
        )}
      </Card>
      <SpotifyConnect open={connectOpen} onOpenChange={setConnectOpen} onConnected={onOpen} />
    </>
  );
}
