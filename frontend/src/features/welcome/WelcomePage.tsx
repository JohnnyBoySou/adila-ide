import { Clock, FolderOpen, GitBranch, Keyboard, Settings, Sparkles, X } from "lucide-react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { motion } from "motion/react";

type ActionRowProps = {
  icon: React.ReactNode;
  label: string;
  shortcut?: React.ReactNode;
  onClick: () => void;
};

function ActionRow({ icon, label, shortcut, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent hover:text-accent-foreground text-left group transition-colors"
    >
      <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          {shortcut}
        </span>
      )}
    </button>
  );
}

type TipRowProps = {
  label: string;
  keys: string[];
};

function TipRow({ label, keys }: TipRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <KbdGroup>
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </KbdGroup>
    </div>
  );
}

type Props = {
  onOpenFolder: () => void;
  onOpenSettings: () => void;
  onOpenKeybindings: () => void;
  onOpenGit: () => void;
  onOpenOnboarding: () => void;
  recentFolders?: string[];
  onOpenRecentFolder?: (path: string) => void;
  onRemoveRecentFolder?: (path: string) => void;
};

export function WelcomePage({
  onOpenFolder,
  onOpenSettings,
  onOpenKeybindings,
  onOpenGit,
  onOpenOnboarding,
  recentFolders = [],
  onOpenRecentFolder,
  onRemoveRecentFolder,
}: Props) {
  return (
    <div className="h-full overflow-y-auto scrollbar">

      {/* Hero */}
      <motion.div
        className="flex flex-col items-center gap-3 pt-12 pb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.img
          src="/icon.png"
          alt="Adila IDE"
          className="w-14 h-14 object-contain"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.05, type: "spring", stiffness: 260, damping: 20 }}
        />
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
        >
          <h1 className="text-2xl font-semibold tracking-tight">Adila IDE</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bem-vindo. Abra uma pasta para começar.
          </p>
        </motion.div>
      </motion.div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-10 py-10">
        <div className="grid grid-cols-2 gap-10">

          {/* Iniciar */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.18, ease: "easeOut" }}
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-3">
              Iniciar
            </h2>
            <div>
              <ActionRow
                icon={<FolderOpen className="size-4" />}
                label="Abrir pasta..."
                shortcut={
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>K</Kbd>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>O</Kbd>
                  </KbdGroup>
                }
                onClick={onOpenFolder}
              />
              <ActionRow
                icon={<GitBranch className="size-4" />}
                label="Controle de versão"
                shortcut={
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>Shift</Kbd>
                    <Kbd>G</Kbd>
                  </KbdGroup>
                }
                onClick={onOpenGit}
              />
              <ActionRow
                icon={<Sparkles className="size-4" />}
                label="Tour de boas-vindas"
                onClick={onOpenOnboarding}
              />
              <ActionRow
                icon={<Settings className="size-4" />}
                label="Configurações"
                shortcut={
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>,</Kbd>
                  </KbdGroup>
                }
                onClick={onOpenSettings}
              />
              <ActionRow
                icon={<Keyboard className="size-4" />}
                label="Atalhos de teclado"
                onClick={onOpenKeybindings}
              />
            </div>
          </motion.section>

          {/* Recentes */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.22, ease: "easeOut" }}
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-3">
              Recentes
            </h2>
            <div className="flex flex-col gap-0.5">
              {recentFolders.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-3">
                  <Clock className="size-4 shrink-0" />
                  <span>Nenhum projeto recente.</span>
                </div>
              ) : (
                recentFolders.map((path) => {
                  const name = path.split("/").filter(Boolean).pop() ?? path;
                  const parent = path.split("/").slice(0, -1).join("/") || "/";
                  return (
                    <div key={path} className="group flex items-center gap-1 rounded-md hover:bg-accent">
                      <button
                        type="button"
                        onClick={() => onOpenRecentFolder?.(path)}
                        className="flex-1 flex items-center gap-3 px-3 py-2 text-sm text-left"
                      >
                        <FolderOpen className="size-4 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{parent}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveRecentFolder?.(path)}
                        aria-label="Remover dos recentes"
                        className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded text-muted-foreground hover:text-foreground transition-opacity"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.section>

        </div>

        {/* Atalhos rápidos */}
        <motion.section
          className="mt-12"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3, ease: "easeOut" }}
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Atalhos essenciais
          </h2>
          <div className="rounded-lg border border-border/60 bg-card/40 px-5">
            <TipRow label="Paleta de comandos" keys={["Ctrl", "Shift", "P"]} />
            <TipRow label="Salvar arquivo" keys={["Ctrl", "S"]} />
            <TipRow label="Buscar no arquivo" keys={["Ctrl", "F"]} />
            <TipRow label="Alternar terminal" keys={["Ctrl", "`"]} />
            <TipRow label="Comentar linha" keys={["Ctrl", "/"]} />
            <TipRow label="Mover linha" keys={["Alt", "↑ ↓"]} />
          </div>
        </motion.section>

      </div>
    </div>
  );
}
