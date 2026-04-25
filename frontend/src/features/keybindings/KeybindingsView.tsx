import { useMemo, useState } from "react";
import { Keyboard, Search, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { filterGroups, keybindingGroups, type Keybinding } from "./keybindingsData";

function KeySequence({ keys }: { keys: string[][] }) {
  return (
    <div className="flex items-center gap-2">
      {keys.map((chord, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <span className="text-xs text-muted-foreground/50 mx-0.5">então</span>
          )}
          <KbdGroup>
            {chord.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </span>
      ))}
    </div>
  );
}

function BindingRow({ binding }: { binding: Keybinding }) {
  return (
    <div className="flex items-center gap-6 py-3 px-2 -mx-2 border-b border-border/40 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{binding.title}</p>
        {binding.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {binding.description}
          </p>
        )}
        {binding.when && (
          <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
            quando: {binding.when}
          </p>
        )}
      </div>
      <div className="shrink-0">
        <KeySequence keys={binding.keys} />
      </div>
    </div>
  );
}

export function KeybindingsView() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(keybindingGroups[0].id);
  const groups = useMemo(() => filterGroups(keybindingGroups, query), [query]);

  const totalCount = groups.reduce((acc, g) => acc + g.bindings.length, 0);

  return (
    <div className="flex h-full w-full">
      <aside className="w-64 shrink-0 border-r border-border/60 bg-card/40 flex flex-col">
        <div className="p-5 border-b border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="size-4 text-primary" />
            <h1 className="text-sm font-semibold">Atalhos de teclado</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar atalho..."
              className="pl-8 h-8"
            />
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
                  {g.bindings.length}
                </span>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border/60">
          <p className="text-[10px] text-muted-foreground text-center">
            {totalCount} atalho{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar">
        <div className="max-w-3xl mx-auto px-10 py-8">
          {groups.length === 0 && (
            <EmptyState
              className="py-20"
              icon={SearchX}
              title="Nada encontrado"
              description={`Nenhum atalho corresponde a "${query}".`}
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
              </header>
              <div className="rounded-lg border border-border/60 bg-card/40 px-5">
                {g.bindings.map((b) => (
                  <BindingRow key={b.id} binding={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
