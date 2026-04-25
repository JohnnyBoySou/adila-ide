import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";

type Editor = MonacoEditor.IStandaloneCodeEditor;

type Position = { x: number; y: number };

type Props = {
  getEditor: () => Editor | null;
  filePath: string;
  children: React.ReactNode;
};

export function EditorContextMenu({ getEditor, filePath, children }: Props) {
  const [pos, setPos] = useState<Position | null>(null);

  return (
    <div
      className="h-full w-full"
      onContextMenu={(e) => {
        if (!getEditor()) return;
        e.preventDefault();
        setPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      {pos && (
        <Menu
          pos={pos}
          editor={getEditor()}
          filePath={filePath}
          onClose={() => setPos(null)}
        />
      )}
    </div>
  );
}

type MenuProps = {
  pos: Position;
  editor: Editor | null;
  filePath: string;
  onClose: () => void;
};

type Item =
  | { kind: "item"; label: string; shortcut?: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
  | { kind: "separator" };

function Menu({ pos, editor, filePath, onClose }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<Position>(pos);

  // Reposiciona se sair da viewport
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = pos.x;
    let y = pos.y;
    if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
    if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
    setAdjusted({ x, y });
  }, [pos]);

  // Fecha em click fora / Escape / scroll
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const trigger = (action: string) => () => {
    if (!editor) return;
    editor.focus();
    editor.trigger("contextmenu", action, null);
    onClose();
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(filePath);
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  const copyFileName = async () => {
    try {
      const name = filePath.split("/").pop() ?? filePath;
      await navigator.clipboard.writeText(name);
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  const hasSelection = editor ? !editor.getSelection()?.isEmpty() : false;

  const items: Item[] = [
    { kind: "item", label: "Ir para definição", shortcut: "F12", onSelect: trigger("editor.action.revealDefinition") },
    { kind: "item", label: "Ir para implementação", shortcut: "Ctrl+F12", onSelect: trigger("editor.action.goToImplementation") },
    { kind: "item", label: "Localizar referências", shortcut: "Shift+F12", onSelect: trigger("editor.action.goToReferences") },
    { kind: "item", label: "Ir para símbolo…", shortcut: "Ctrl+Shift+O", onSelect: trigger("editor.action.quickOutline") },
    { kind: "separator" },
    { kind: "item", label: "Renomear símbolo", shortcut: "F2", onSelect: trigger("editor.action.rename") },
    { kind: "item", label: "Refatorar…", shortcut: "Ctrl+.", onSelect: trigger("editor.action.refactor") },
    { kind: "item", label: "Ações rápidas", shortcut: "Ctrl+.", onSelect: trigger("editor.action.quickFix") },
    { kind: "separator" },
    { kind: "item", label: "Recortar", shortcut: "Ctrl+X", onSelect: trigger("editor.action.clipboardCutAction"), disabled: !hasSelection },
    { kind: "item", label: "Copiar", shortcut: "Ctrl+C", onSelect: trigger("editor.action.clipboardCopyAction"), disabled: !hasSelection },
    { kind: "item", label: "Colar", shortcut: "Ctrl+V", onSelect: trigger("editor.action.clipboardPasteAction") },
    { kind: "separator" },
    { kind: "item", label: "Formatar documento", shortcut: "Shift+Alt+F", onSelect: trigger("editor.action.formatDocument") },
    { kind: "item", label: "Formatar seleção", shortcut: "Ctrl+K Ctrl+F", onSelect: trigger("editor.action.formatSelection"), disabled: !hasSelection },
    { kind: "item", label: "Comentar linha", shortcut: "Ctrl+/", onSelect: trigger("editor.action.commentLine") },
    { kind: "separator" },
    { kind: "item", label: "Copiar caminho do arquivo", onSelect: copyPath },
    { kind: "item", label: "Copiar nome do arquivo", onSelect: copyFileName },
    { kind: "separator" },
    { kind: "item", label: "Paleta de comandos", shortcut: "Ctrl+Shift+P", onSelect: trigger("editor.action.quickCommand") },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[260px] py-1 rounded-md border bg-popover text-popover-foreground shadow-lg outline-none animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: adjusted.x, top: adjusted.y }}
      role="menu"
    >
      {items.map((item, i) =>
        item.kind === "separator" ? (
          <div key={`sep-${i}`} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={`item-${i}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={item.onSelect}
            className={
              "w-full flex items-center justify-between gap-6 px-3 py-1.5 text-sm text-left outline-none transition-colors " +
              (item.disabled
                ? "text-muted-foreground/50 cursor-not-allowed "
                : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer ") +
              (item.danger ? "text-destructive " : "")
            }
          >
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <span className="shrink-0 text-[11px] text-muted-foreground tracking-wide font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
        ),
      )}
    </div>
  );
}
