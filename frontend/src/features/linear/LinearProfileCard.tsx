import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
import { LinearConnect } from "./LinearConnect";
import { LinearIcon } from "./LinearIcon";
import { linearRpc, type LinearUser } from "./rpc";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "LN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LinearProfileCard() {
  const [user, setUser] = useState<LinearUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const authed = await linearRpc.isAuthenticated();
      if (!authed) {
        setUser(null);
        return;
      }
      const me = await linearRpc.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const off = linearRpc.onAuthed(() => void refresh());
    return () => off();
  }, [refresh]);

  const openLinear = useCallback(() => {
    EventsEmit("commandCenter.exec", "openLinear");
  }, []);

  const handleClick = useCallback(() => {
    if (user) {
      openLinear();
    } else {
      setConnectOpen(true);
    }
  }, [user, openLinear]);

  if (loading) {
    return (
      <Card className="flex h-20 items-center justify-center p-4 bg-transparent">
        <Spinner />
      </Card>
    );
  }

  const connected = !!user;
  const displayName = user?.displayName || user?.name || "Linear";
  const subtitle = connected
    ? "Linear conectado"
    : "Conecte sua conta para ver suas issues no IDE.";
  const avatarUrl = user?.avatarUrl;

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
          <AvatarFallback className="bg-violet-500/10 text-violet-400">
            {connected ? initials(displayName) : <LinearIcon className="size-6" />}
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
            className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all group-hover:brightness-110"
          >
            Entrar
          </span>
        )}
      </Card>
      <LinearConnect
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => {
          void refresh();
        }}
      />
    </>
  );
}
