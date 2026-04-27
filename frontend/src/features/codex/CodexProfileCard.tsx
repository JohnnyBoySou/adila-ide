import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { CodexConnect } from "./CodexConnect";
import { CodexIcon } from "./CodexIcon";
import { useCodexAuth } from "./useCodexAuth";

type CodexProfileCardProps = {
  /** Chamado quando o card já está configurado e o usuário clica (abrir
   * painel de agente). Sem isso, o clique reabre o modal de config. */
  onOpen?: () => void;
};

export function CodexProfileCard({ onOpen }: CodexProfileCardProps) {
  const { configured, masked, model } = useCodexAuth();
  const [connectOpen, setConnectOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (configured && onOpen) {
      onOpen();
    } else {
      setConnectOpen(true);
    }
  }, [configured, onOpen]);

  const subtitle = configured
    ? `${masked ?? "API key salva"} · ${model}`
    : "Configure sua API key da OpenAI para usar o Codex.";

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
          <AvatarFallback className="bg-emerald-500/15 text-emerald-500">
            <CodexIcon className="size-6" />
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">Codex</span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {configured ? (
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        ) : (
          <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black shadow-sm transition-all group-hover:brightness-110"
          >
            Configurar
          </span>
        )}
      </Card>
      <CodexConnect open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}
