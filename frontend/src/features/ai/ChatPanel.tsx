import { useEffect, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant";
type Message = { id: number; role: Role; text: string; streaming?: boolean };

const MOCK_RESPONSES = [
  "Claro! Posso te ajudar com isso. Qual é o contexto do arquivo que você está editando?",
  "Boa pergunta. Com base no que vejo no código, sugiro extrair essa lógica para um hook separado — fica mais fácil de testar e reutilizar.",
  "O padrão que você está usando é válido, mas considere adicionar um `useCallback` aqui para evitar recriações desnecessárias da função.",
  "Para esse caso específico, a abordagem mais idiomática em TypeScript seria usar um discriminated union em vez de booleanos separados.",
  "Analisando o código: a dependência circular entre esses dois módulos pode causar problemas no bundler. Sugiro extrair o tipo compartilhado para um terceiro arquivo.",
];

let msgId = 0;

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { id: ++msgId, role: "assistant", text: "Olá! Sou a Adila, sua assistente de código. Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: Message = { id: ++msgId, role: "user", text };
    const asstId = ++msgId;
    const asstMsg: Message = { id: asstId, role: "assistant", text: "", streaming: true };

    setMessages((m) => [...m, userMsg, asstMsg]);

    // mock: stream character by character
    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setMessages((m) =>
        m.map((msg) =>
          msg.id === asstId ? { ...msg, text: response.slice(0, i) } : msg,
        ),
      );
      if (i >= response.length) {
        clearInterval(interval);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === asstId ? { ...msg, streaming: false } : msg,
          ),
        );
        setBusy(false);
      }
    }, 18);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-muted/20">
        <Bot className="size-4 text-primary" />
        <span className="font-medium text-xs">Adila AI</span>
        <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">mock</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}
          >
            <div className={cn(
              "size-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}>
              {msg.role === "user"
                ? <User className="size-3.5" />
                : <Bot className="size-3.5 text-primary" />}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground",
            )}>
              {msg.text}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current opacity-70 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-2">
        <div className="flex items-end gap-2 bg-muted/40 rounded-lg px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre o código…"
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm placeholder:text-muted-foreground max-h-32"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="shrink-0 p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <Send className="size-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          Enter para enviar · Shift+Enter nova linha
        </p>
      </div>
    </div>
  );
}
