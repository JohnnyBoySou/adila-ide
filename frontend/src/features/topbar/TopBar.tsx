import { Button } from "@/components/ui/button";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Maximize2, Menu, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BrowserOpenURL,
  Quit,
  WindowIsMaximised,
  WindowMinimise,
  WindowToggleMaximise,
} from "../../../wailsjs/runtime/runtime";
import { EventsEmit } from "../../../wailsjs/runtime/runtime";
import { useUiStore } from "@/stores/uiStore";

// Wails v2 reconhece o atributo CSS --wails-draggable nos style do elemento.
// "drag" → arrastar a janela; "no-drag" → impede em filhos clicáveis.
const dragStyle = { "--wails-draggable": "drag" } as React.CSSProperties;
const noDragStyle = { "--wails-draggable": "no-drag" } as React.CSSProperties;

type View =
  | "editor"
  | "settings"
  | "about"
  | "onboarding"
  | "git"
  | "keybindings"
  | "bench"
  | "themeEditor"
  | "notifications"
  | "githubProfile"
  | "spotify";

type Props = {
  terminalOpen: boolean;
  problemsOpen: boolean;
  zenMode: boolean;
  spotifyEnabled: boolean;
  sidebarVisible: boolean;
  /**
   * Quando true, o item "Preview Markdown" do menu Extensões fica
   * habilitado. Vem do App raiz porque ele já calcula `isMarkdown` a partir
   * da extensão da tab ativa; centralizar aqui evitaria reimplementar a
   * derivação.
   */
  isMarkdownActive: boolean;
  onOpenFolder: () => void;
  onSave: () => void;
  onCloseTab: () => void;
  onToggleTerminal: () => void;
  onToggleSidebar: () => void;
  onToggleProblems: () => void;
  onSetView: (view: View) => void;
  onOpenPalette: () => void;
  onOpenQuickFile: () => void;
  onToggleZen: () => void;
  onToggleSpotify: () => void;
  onSplitRight: () => void;
  onSplitDown: () => void;
  onOpenUrl: () => void;
  onGotoSymbol: () => void;
  onFindInFiles: () => void;
};

export function TopBar({
  terminalOpen,
  problemsOpen,
  zenMode,
  spotifyEnabled,
  sidebarVisible,
  isMarkdownActive,
  onOpenFolder,
  onSave,
  onCloseTab,
  onToggleTerminal,
  onToggleSidebar,
  onToggleProblems,
  onSetView,
  onOpenPalette,
  onOpenQuickFile,
  onToggleZen,
  onToggleSpotify,
  onSplitRight,
  onSplitDown,
  onOpenUrl,
  onGotoSymbol,
  onFindInFiles,
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isMaximised, setIsMaximised] = useState(false);

  // Estado dos viewers ativáveis. Cada checkbox do menu "Extensões"
  // reflete e altera essas flags do uiStore. Usamos selectors estreitos
  // pra que clicar em outras partes da UI não dispare re-render do menu.
  const livePreviewOpen = useUiStore((s) => s.livePreviewOpen);
  const markdownPreviewOpen = useUiStore((s) => s.markdownPreviewOpen);
  const setLivePreviewOpen = useUiStore((s) => s.setLivePreviewOpen);
  const setMarkdownPreviewOpen = useUiStore((s) => s.setMarkdownPreviewOpen);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      WindowIsMaximised()
        .then((v) => {
          if (!cancelled) setIsMaximised(!!v);
        })
        .catch(() => {});
    };
    sync();
    const onResize = () => sync();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <header className="border-b px-2 py-1 flex items-center gap-2 shrink-0" style={dragStyle}>
      <div className="flex items-center gap-2" style={noDragStyle}>
        <Button
          variant="ghost"
          size="icon"
          style={noDragStyle}
          title="Alternar menu"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Menu className="size-4" />
        </Button>

        {isMenuOpen && (
          <Menubar
            style={noDragStyle}
            className="border-none shadow-none bg-transparent h-auto p-0 gap-0"
          >
            <span className="font-semibold text-sm px-1 mr-1">Adila IDE</span>

            {/* ── Arquivo ── */}
            <MenubarMenu>
              <MenubarTrigger className="text-xs font-light">Arquivo</MenubarTrigger>
              <MenubarContent>
                <MenubarItem className="text-xs" onSelect={onOpenFolder}>
                  Abrir pasta…
                  <MenubarShortcut>Ctrl+K O</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={onOpenQuickFile}>
                  Abrir arquivo…
                  <MenubarShortcut>Ctrl+P</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={onOpenUrl}>
                  Abrir URL como aba…
                  <MenubarShortcut>Ctrl+Shift+U</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={onSave}>
                  Salvar
                  <MenubarShortcut>Ctrl+S</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={onCloseTab}>
                  Fechar aba
                  <MenubarShortcut>Ctrl+W</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" variant="destructive" onSelect={() => Quit()}>
                  Sair
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* ── Editar ── */}
            <MenubarMenu>
              <MenubarTrigger className="text-xs font-light">Editar</MenubarTrigger>
              <MenubarContent>
                <MenubarItem className="text-xs" onSelect={() => EventsEmit("editor.undo")}>
                  Desfazer
                  <MenubarShortcut>Ctrl+Z</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => EventsEmit("editor.redo")}>
                  Refazer
                  <MenubarShortcut>Ctrl+Y</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => document.execCommand("cut")}>
                  Recortar
                  <MenubarShortcut>Ctrl+X</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => document.execCommand("copy")}>
                  Copiar
                  <MenubarShortcut>Ctrl+C</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => document.execCommand("paste")}>
                  Colar
                  <MenubarShortcut>Ctrl+V</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => EventsEmit("editor.find")}>
                  Localizar no arquivo
                  <MenubarShortcut>Ctrl+F</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => EventsEmit("editor.replace")}>
                  Substituir no arquivo
                  <MenubarShortcut>Ctrl+H</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={onFindInFiles}>
                  Localizar nos arquivos
                  <MenubarShortcut>Ctrl+Shift+F</MenubarShortcut>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* ── Exibir ── */}
            <MenubarMenu>
              <MenubarTrigger className="text-xs font-light">Exibir</MenubarTrigger>
              <MenubarContent>
                <MenubarItem className="text-xs" onSelect={onOpenPalette}>
                  Paleta de comandos
                  <MenubarShortcut>Ctrl+Shift+P</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarCheckboxItem
                  className="text-xs"
                  checked={sidebarVisible}
                  onCheckedChange={() => onToggleSidebar()}
                >
                  Explorador de arquivos
                  <MenubarShortcut>Ctrl+B</MenubarShortcut>
                </MenubarCheckboxItem>
                <MenubarCheckboxItem
                  className="text-xs"
                  checked={terminalOpen}
                  onCheckedChange={() => onToggleTerminal()}
                >
                  Terminal
                  <MenubarShortcut>Ctrl+J</MenubarShortcut>
                </MenubarCheckboxItem>
                <MenubarCheckboxItem
                  className="text-xs"
                  checked={problemsOpen}
                  onCheckedChange={() => onToggleProblems()}
                >
                  Problemas
                  <MenubarShortcut>Ctrl+Shift+M</MenubarShortcut>
                </MenubarCheckboxItem>
                <MenubarItem className="text-xs" onSelect={() => onSetView("git")}>
                  Controle de versão
                </MenubarItem>
                <MenubarSeparator />
                <MenubarSub>
                  <MenubarSubTrigger className="text-xs">Dividir editor</MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem className="text-xs" onSelect={onSplitRight}>
                      Dividir à direita
                      <MenubarShortcut>Ctrl+\</MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem className="text-xs" onSelect={onSplitDown}>
                      Dividir abaixo
                      <MenubarShortcut>Ctrl+K \</MenubarShortcut>
                    </MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => onSetView("settings")}>
                  Configurações
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => onSetView("keybindings")}>
                  Atalhos de teclado
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => onSetView("bench")}>
                  Benchmark de runtime
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* ── Ir para ── */}
            <MenubarMenu>
              <MenubarTrigger className="text-xs font-light">Ir para</MenubarTrigger>
              <MenubarContent>
                <MenubarItem className="text-xs" onSelect={onOpenQuickFile}>
                  Arquivo…
                  <MenubarShortcut>Ctrl+P</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={onGotoSymbol}>
                  Símbolo…
                  <MenubarShortcut>Ctrl+Shift+O</MenubarShortcut>
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => EventsEmit("editor.gotoLine")}>
                  Linha…
                  <MenubarShortcut>Ctrl+G</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={onOpenUrl}>
                  URL como aba…
                  <MenubarShortcut>Ctrl+Shift+U</MenubarShortcut>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* ── Extensões ──
            Centraliza viewers e modos ativáveis. Toggles usam MenubarItem
            regular pra alinhar com "Editor de tema" (sem o pl-8 reservado
            do MenubarCheckboxItem). preventDefault no onSelect mantém o
            menu aberto após o click, útil pra ligar/desligar em sequência. */}
            <MenubarMenu>
              <MenubarTrigger className="text-xs font-light">Extensões</MenubarTrigger>
              <MenubarContent>
                <MenubarItem
                  className="text-xs"
                  onSelect={(e) => {
                    e.preventDefault();
                    setLivePreviewOpen(!livePreviewOpen);
                  }}
                >
                  Live Preview
                  <MenubarShortcut>localhost</MenubarShortcut>
                </MenubarItem>
                <MenubarItem
                  className="text-xs"
                  disabled={!isMarkdownActive}
                  onSelect={(e) => {
                    e.preventDefault();
                    setMarkdownPreviewOpen(!markdownPreviewOpen);
                  }}
                >
                  Preview Markdown
                  <MenubarShortcut>{isMarkdownActive ? ".md/.mdx" : "abra um .md"}</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem
                  className="text-xs"
                  onSelect={(e) => {
                    e.preventDefault();
                    onToggleSpotify();
                  }}
                >
                  Mini-player Spotify
                  <MenubarShortcut>Ctrl+Alt+M</MenubarShortcut>
                </MenubarItem>
                <MenubarItem
                  className="text-xs"
                  onSelect={(e) => {
                    e.preventDefault();
                    onToggleZen();
                  }}
                >
                  Modo zen
                  <MenubarShortcut>Ctrl+K Z</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => onSetView("themeEditor")}>
                  Editor de tema
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            {/* ── Ajuda ── */}
            <MenubarMenu>
              <MenubarTrigger className="text-xs font-light">Ajuda</MenubarTrigger>
              <MenubarContent>
                <MenubarItem className="text-xs" onSelect={onOpenPalette}>
                  Paleta de comandos
                  <MenubarShortcut>Ctrl+Shift+P</MenubarShortcut>
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => onSetView("onboarding")}>
                  Tour de boas-vindas
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => onSetView("keybindings")}>
                  Atalhos de teclado
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => onSetView("githubProfile")}>
                  Perfil do GitHub
                </MenubarItem>
                <MenubarItem className="text-xs" onSelect={() => onSetView("notifications")}>
                  Notificações
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem
                  className="text-xs"
                  onSelect={() =>
                    BrowserOpenURL("https://github.com/JohnnyBoySou/adila-ide/issues")
                  }
                >
                  Reportar problema
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem className="text-xs" onSelect={() => onSetView("about")}>
                  Sobre o Adila IDE
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        )}
      </div>

      {/* Área de arrasto da janela (Wails) — preenche o espaço entre menu e controles */}
      <div
        className="flex-1 self-stretch"
        style={dragStyle}
        onDoubleClick={() => {
          WindowToggleMaximise();
          setIsMaximised((v) => !v);
        }}
      />

      {/* Controles de janela */}
      <div className="flex items-center gap-0.5" style={noDragStyle}>
        <button
          type="button"
          onClick={() => WindowMinimise()}
          aria-label="Minimizar"
          title="Minimizar"
          className="h-7 w-9 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            WindowToggleMaximise();
            // estado atualiza no próximo evento de resize
            setIsMaximised((v) => !v);
          }}
          aria-label={isMaximised ? "Restaurar" : "Maximizar"}
          title={isMaximised ? "Restaurar" : "Maximizar"}
          className="h-7 w-9 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {isMaximised ? <Square className="size-3" /> : <Maximize2 className="size-3" />}
        </button>
        <button
          type="button"
          onClick={() => Quit()}
          aria-label="Fechar"
          title="Fechar"
          className="h-7 w-9 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </header>
  );
}
