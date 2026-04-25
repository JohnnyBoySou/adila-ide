import { useEffect, useMemo, useState } from "react";
import { Check, FileJson, Search, SearchX, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog } from "@/components/ui/dialog";
import { Command, type CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { SettingRow } from "./components/SettingRow";
import { filterGroups, settingsGroups, type SettingDef } from "./settingsSchema";
import { rpc } from "./rpc";

interface SettingCommandItem extends CommandItem {
  groupId: string;
  def: SettingDef;
}

const paletteItems: SettingCommandItem[] = settingsGroups.flatMap((group) =>
  group.settings.map((def) => ({
    id: `${group.id}:${def.key}`,
    title: def.title,
    description: `${group.title} · ${def.key}`,
    keywords: [def.key, group.title, ...(def.keywords ?? [])],
    groupId: group.id,
    def,
  })),
);

export function SettingsView() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(settingsGroups[0].id);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const groups = useMemo(() => filterGroups(settingsGroups, query), [query]);

  useEffect(() => {
    return rpc.on("settings.search", (payload) => {
      if (typeof payload === "string") {
        setQuery(payload);
      }
    });
  }, []);

  useEffect(() => {
    if (query && groups.length > 0 && !groups.find((g) => g.id === activeId)) {
      setActiveId(groups[0].id);
    }
  }, [query, groups, activeId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    const timer = window.setTimeout(() => setHighlightKey(undefined), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightKey]);

  function handleSave() {
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function openJson() {
    rpc.settings.openJson().catch((err: unknown) => {
      toast.error("Não foi possível abrir settings.json", err);
    });
  }

  function onPaletteSelect(item: SettingCommandItem) {
    setPaletteOpen(false);
    setQuery("");
    setActiveId(item.groupId);
    setHighlightKey(item.def.key);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`setting-${item.def.key}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <div className="flex h-full w-full">
      <aside className="w-64 shrink-0 border-r border-border/60 bg-card/40 flex flex-col">
        <div className="p-5 border-b border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="size-4 text-primary" />
            <h1 className="text-sm font-semibold">Settings</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-12 h-8"
            />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              title="Abrir paleta de comandos"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent"
            >
              ⌘K
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar p-2">
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-4">
              Nada encontrado.
            </p>
          )}
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setActiveId(g.id);
                document.getElementById(`group-${g.id}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                activeId === g.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{g.title}</span>
                <span className="text-[10px] tabular-nums text-muted-foreground/70">
                  {g.settings.length}
                </span>
              </div>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-border/60">
          <Button
            variant="outline"
            size="sm"
            onClick={openJson}
            className="w-full justify-start"
          >
            <FileJson className="size-4" />
            Editar settings.json
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar">
        <div className="max-w-3xl mx-auto px-10 py-8 pb-24">
          {groups.length === 0 && (
            <EmptyState
              className="py-20"
              icon={SearchX}
              title="Nada encontrado"
              description={`Nenhuma configuração corresponde a "${query}".`}
            />
          )}
          {groups.map((g) => (
            <section
              key={g.id}
              id={`group-${g.id}`}
              className="mb-10 scroll-mt-8"
            >
              <header className="mb-4">
                <h2 className="text-lg font-semibold">{g.title}</h2>
                {g.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {g.description}
                  </p>
                )}
              </header>
              <div className="rounded-lg border border-border/60 bg-card/40 px-5">
                {g.settings.map((s) => (
                  <SettingRow
                    key={s.key}
                    def={s}
                    highlighted={highlightKey === s.key}
                    onDirty={() => setDirty(true)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <AnimatePresence>
          {(dirty || saved) && (
            <motion.div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <button
                type="button"
                onClick={handleSave}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium shadow-lg transition-colors duration-200",
                  saved
                    ? "bg-green-500/90 text-white"
                    : "bg-primary text-primary-foreground hover:opacity-90 active:scale-95",
                )}
              >
                {saved ? (
                  <>
                    <Check className="size-4" />
                    Configurações salvas
                  </>
                ) : (
                  "Salvar configurações"
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Dialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        ariaLabel="Paleta de configurações"
      >
        <Command<SettingCommandItem>
          items={paletteItems}
          placeholder="Buscar configuração..."
          emptyMessage="Nenhuma configuração encontrada."
          onSelect={onPaletteSelect}
          footer={
            <div className="flex items-center justify-between">
              <span>↑↓ navegar · ↵ ir para · esc fechar</span>
              <span className="font-mono">⌘K</span>
            </div>
          }
        />
      </Dialog>
    </div>
  );
}
