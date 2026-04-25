import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { toast } from "@/hooks/useToast";
import { rpc } from "../rpc";

export function OpenFolder() {
  function openPicker() {
    rpc.config
      .set("adila.onboarding.pendingOpenFolder", true)
      .catch((err: unknown) => {
        toast.error("Não foi possível agendar a escolha de pasta", err);
      });
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <div className="w-full overflow-hidden rounded-xl border border-border/50 shadow-sm bg-muted/30">
        <img
          src="/onboarding_3.png"
          alt="Explorador de arquivos"
          className="w-full object-cover max-h-56"
        />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Abrir uma pasta
        </h2>
        <p className="text-sm text-muted-foreground">
          Você pode começar agora abrindo um projeto existente ou deixar pra
          depois.
        </p>
      </div>
      <Button variant="outline" onClick={openPicker}>
        <FolderOpen className="size-4" />
        Escolher pasta depois
      </Button>
    </div>
  );
}
