import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { rpc } from "./rpc";
import { CLI } from "./steps/CLI";
import { GitHub } from "./steps/GitHub";
import { OpenFolder } from "./steps/OpenFolder";
import { Theme } from "./steps/Theme";
import { Welcome } from "./steps/Welcome";

const steps = [
  { id: "welcome", label: "Boas-vindas", Component: Welcome },
  { id: "theme", label: "Tema", Component: Theme },
  { id: "cli", label: "CLI", Component: CLI },
  { id: "github", label: "GitHub", Component: GitHub },
  { id: "folder", label: "Pasta", Component: OpenFolder },
];

type Props = { onComplete?: () => void };

export function OnboardingView({ onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const StepComponent = step.Component;

  function next() {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }

  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function finish() {
    setFinishing(true);
    rpc.onboarding
      .complete()
      .then(() => onComplete?.())
      .catch((err: unknown) => {
        toast.error("Não foi possível concluir o onboarding", err);
        setFinishing(false);
      });
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-8 overflow-hidden">
      <div className="flex w-full max-w-xl flex-col gap-8">
        {/* Step content — fade simples, sem slide */}
        <div className="overflow-hidden w-full min-h-[260px] flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full"
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: dots à esquerda, botões à direita */}
        <footer className="flex items-center justify-between">
          {/* Progress dots */}
          <nav className="flex items-center gap-2">
            {steps.map((s, i) => (
              <motion.div
                key={s.id}
                animate={{
                  width: i === index ? 24 : 6,
                  opacity: i <= index ? 1 : 0.3,
                }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                className={cn(
                  "h-1.5 rounded-full",
                  i <= index ? "bg-primary" : "bg-muted-foreground",
                )}
              />
            ))}
          </nav>

          {/* Botões à direita */}
          <div className="flex items-center gap-2">
            <Button
              variant="link"
              size="sm"
              onClick={finish}
              disabled={finishing}
              className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors p-2 underline"
            >
              Pular
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={back}
              disabled={index === 0}
              className="size-11 rounded-full text-muted-foreground"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-5" />
            </Button>

            <Button
              variant={isLast ? "default" : "ghost"}
              size="icon"
              onClick={next}
              disabled={finishing}
              className={cn("size-11 rounded-full", !isLast && "text-muted-foreground")}
              aria-label={isLast ? "Concluir" : "Próximo"}
            >
              {isLast ? <Check className="size-5" /> : <ArrowRight className="size-5" />}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
