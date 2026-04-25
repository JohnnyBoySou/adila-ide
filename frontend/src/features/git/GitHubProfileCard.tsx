import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
import { GitHubConnect } from "./GitHubConnect";
import { GithubIcon } from "./GithubIcon";
import { rpc } from "./rpc";
import type { GitHubUser } from "./types";

function initials(user: GitHubUser): string {
  const source = user.name?.trim() || user.login;
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return source.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function GitHubProfileCard() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const auth = await rpc.github.isAuthenticated();
      if (!auth) {
        setUser(null);
        return;
      }
      const u = await rpc.github.getUser();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openProfile = useCallback(() => {
    EventsEmit("commandCenter.exec", "openGitHubProfile");
  }, []);

  if (loading) {
    return (
      <Card className="flex h-20 items-center justify-center p-4">
        <Spinner />
      </Card>
    );
  }

  if (!user) {
    return (
      <>
        <Card className="flex flex-row items-center gap-3 p-4">
          <Avatar size="lg">
            <AvatarFallback>
              <GithubIcon className="size-5 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-medium">Conecte ao GitHub</span>
            <span className="truncate text-xs text-muted-foreground">
              Publique repositórios direto da IDE.
            </span>
          </div>
          <Button size="sm" onClick={() => setConnectOpen(true)} className="gap-2">
            <GithubIcon className="size-3.5" />
            Entrar
          </Button>
        </Card>
        <GitHubConnect
          open={connectOpen}
          onOpenChange={setConnectOpen}
          onAuthenticated={(u) => setUser(u)}
        />
      </>
    );
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={openProfile}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openProfile();
        }
      }}
      className="group flex flex-row items-center gap-3 p-4 transition-colors cursor-pointer hover:bg-accent/40"
    >
      <Avatar size="lg">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.login} />}
        <AvatarFallback>{initials(user)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{user.name || user.login}</span>
        <span className="truncate text-xs text-muted-foreground">@{user.login}</span>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Card>
  );
}
