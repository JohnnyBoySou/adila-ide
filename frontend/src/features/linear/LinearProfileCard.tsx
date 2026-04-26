import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight, SquareCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
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
  const [connecting, setConnecting] = useState(false);

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

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await linearRpc.startOAuth();
      await refresh();
    } catch {
      // erro visível no LinearView
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  if (loading) {
    return (
      <Card className="flex h-20 items-center justify-center p-4 bg-transparent">
        <Spinner />
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="flex bg-transparent flex-row items-center gap-3 p-4">
        <Avatar size="lg">
          <AvatarFallback className="bg-violet-500/10">
            <SquareCheck className="size-5 text-violet-400" />
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-medium">Conecte ao Linear</span>
          <span className="truncate text-xs text-muted-foreground">
            Veja suas issues diretamente no IDE.
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => void handleConnect()}
          disabled={connecting}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
        >
          {connecting ? (
            <Spinner className="size-3.5" />
          ) : (
            <SquareCheck className="size-3.5" />
          )}
          Entrar
        </Button>
      </Card>
    );
  }

  const displayName = user.displayName || user.name;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={openLinear}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLinear();
        }
      }}
      className="group flex flex-row items-center bg-transparent gap-3 p-4 transition-colors cursor-pointer hover:bg-accent/40"
    >
      <Avatar size="lg">
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={displayName} />
        ) : null}
        <AvatarFallback className="bg-violet-500/10 text-violet-400">
          {initials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground">Linear conectado</span>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Card>
  );
}
