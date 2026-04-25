import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { rpc } from "./rpc";
import { Welcome } from "./steps/Welcome";
import { Theme } from "./steps/Theme";
import { OpenFolder } from "./steps/OpenFolder";

const steps = [
  { id: "welcome", label: "Boas-vindas", Component: Welcome },
  { id: "theme", label: "Tema", Component: Theme },
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
            <button
              type="button"
              onClick={finish}
              disabled={finishing}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-40 transition-colors"
            >
              pular
            </button>

            <button
              type="button"
              onClick={back}
              disabled={index === 0}
              className="flex items-center justify-center size-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-5" />
            </button>

            <button
              type="button"
              onClick={next}
              disabled={finishing}
              className={cn(
                "flex items-center justify-center size-11 rounded-full transition-colors",
                isLast
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30",
              )}
              aria-label={isLast ? "Concluir" : "Próximo"}
            >
              {isLast ? <Check className="size-5" /> : <ArrowRight className="size-5" />}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
