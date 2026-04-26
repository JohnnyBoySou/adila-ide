import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ChevronRight, Music } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { spotifyApi, type SpotifyMe } from "./api";
import { useSpotifyAuth } from "./useSpotifyAuth";

type SpotifyProfileCardProps = {
  onOpen: () => void;
};

export function SpotifyProfileCard({ onOpen }: SpotifyProfileCardProps) {
  const { connected, getToken } = useSpotifyAuth();
  const [profile, setProfile] = useState<SpotifyMe | null>(null);

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

  const openSpotify = useCallback(() => {
    onOpen();
  }, [onOpen]);

  const displayName = profile?.display_name || "Spotify";
  const subtitle = profile
    ? profile.product === "premium"
      ? "Conta Premium conectada"
      : "Conta conectada"
    : "Abra o Spotify modal para controlar sua musica.";
  const avatarUrl = profile?.images?.[0]?.url;
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "SP";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={openSpotify}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSpotify();
        }
      }}
      className="group flex flex-row items-center bg-transparent gap-3 p-4 transition-colors cursor-pointer hover:bg-accent/40"
    >
      <Avatar size="lg">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback className="bg-green-500/10 text-green-500">
          {profile ? initials : <Music className="size-5" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Card>
  );
}
