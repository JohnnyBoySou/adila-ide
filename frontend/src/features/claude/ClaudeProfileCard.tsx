import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { ClaudeConnect } from "./ClaudeConnect";
import { ClaudeIcon } from "./ClaudeIcon";
import { useClaudeAuth } from "./useClaudeAuth";

type ClaudeProfileCardProps = {
  /** Chamado quando o usuário clica no card já conectado (ex.: abrir o
   * painel do agente). Sem isso o clique apenas reabre o modal de config. */
  onOpen?: () => void;
};

export function ClaudeProfileCard({ onOpen }: ClaudeProfileCardProps) {
  const { configured, masked, model } = useClaudeAuth();
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
    : "Configure sua API key da Anthropic para falar com o agente.";

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
          <AvatarFallback className="bg-[#cc785c]/15 text-[#cc785c]">
            <ClaudeIcon className="size-6" />
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">Claude</span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {configured ? (
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        ) : (
          <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-full bg-[#cc785c] px-3 py-1 text-xs font-semibold text-white shadow-sm transition-all group-hover:brightness-110"
          >
            Configurar
          </span>
        )}
      </Card>
      <ClaudeConnect open={connectOpen} onOpenChange={setConnectOpen} />
    </>
  );
}
