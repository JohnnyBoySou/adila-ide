import { useEffect, useState } from "react";
import { FolderOpen, GitFork, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/useToast";
import { CloneRepo } from "../../../wailsjs/go/main/GitHub";
import { OpenFolderDialog } from "../../../wailsjs/go/main/App";
import type { main as gh } from "../../../wailsjs/go/models";

type Repo = gh.GitHubUserRepo;

interface Props {
  repo: Repo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned?: (path: string) => void;
}

export function CloneRepoDialog({ repo, open, onOpenChange, onCloned }: Props) {
  const [parent, setParent] = useState<string>("");
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (!open) {
      setCloning(false);
      setParent("");
    }
  }, [open]);

  if (!repo) return null;

  const dest = parent ? `${parent.replace(/\/$/, "")}/${repo.name}` : "";

  const pickFolder = async () => {
    try {
      const picked = await OpenFolderDialog();
      if (picked) setParent(picked);
    } catch (err) {
      toast.error("Não foi possível abrir o seletor de pasta", err);
    }
  };

  const doClone = async () => {
    if (!parent) return;
    setCloning(true);
    try {
      const finalPath = await CloneRepo(repo.cloneUrl, parent, repo.name);
      toast.success(`Repositório clonado em ${finalPath}`);
      onCloned?.(finalPath);
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao clonar", err);
      setCloning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} ariaLabel="Clonar repositório">
      <div className="flex flex-col gap-4 p-5">
        <header className="flex flex-col gap-3">
          <h1 className="text-lg font-semibold">Fazer clone do repositório</h1>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
              <GitFork className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm font-medium">{repo.fullName}</h2>
                {repo.private && <Lock className="size-3.5 text-muted-foreground" aria-label="privado" />}
              </div>
              {repo.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {repo.description}
                </p>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Pasta de destino
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={pickFolder}
            disabled={cloning}
            className="justify-start gap-2 font-normal"
          >
            <FolderOpen className="size-4 shrink-0" />
            <span className="truncate text-left">
              {parent || "Escolher pasta…"}
            </span>
          </Button>
          {dest && (
            <p className="text-xs text-muted-foreground">
              Será clonado em <span className="font-mono text-foreground/80">{dest}</span>
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={cloning}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={doClone} disabled={!parent || cloning} className="gap-2">
            {cloning ? <Spinner size="xs" /> : <GitFork className="size-4" />}
            {cloning ? "Clonando…" : "Clonar"}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
