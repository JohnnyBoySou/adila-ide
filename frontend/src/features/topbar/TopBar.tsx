import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

type View = "editor" | "settings" | "about" | "onboarding" | "git" | "keybindings";

type Props = {
  rootPath: string;
  terminalOpen: boolean;
  zenMode: boolean;
  onOpenFolder: () => void;
  onSave: () => void;
  onCloseTab: () => void;
  onToggleTerminal: () => void;
  onSetView: (view: View) => void;
  onOpenPalette: () => void;
  onToggleZen: () => void;
};

export function TopBar({
  rootPath,
  terminalOpen,
  zenMode,
  onOpenFolder,
  onSave,
  onCloseTab,
  onToggleTerminal,
  onSetView,
  onOpenPalette,
  onToggleZen,
}: Props) {
  return (
    <header className="border-b px-2 py-1 flex items-center gap-2 shrink-0">
      <span className="font-semibold text-sm px-1 mr-1">Adila IDE</span>

      <Menubar className="border-none shadow-none bg-transparent h-auto p-0 gap-0">
        <MenubarMenu>
          <MenubarTrigger className="text-xs">Arquivo</MenubarTrigger>
          <MenubarContent>
            <MenubarItem className="text-xs" onSelect={onOpenFolder}>
              Abrir pasta…
              <MenubarShortcut>Ctrl+K O</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem className="text-xs" onSelect={onSave}>
              Salvar
              <MenubarShortcut>Ctrl+S</MenubarShortcut>
            </MenubarItem>
            <MenubarItem className="text-xs" onSelect={onCloseTab}>
              Fechar aba
              <MenubarShortcut>Ctrl+W</MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Exibir</MenubarTrigger>
          <MenubarContent>
            <MenubarItem className="text-xs" onSelect={onOpenPalette}>
              Paleta de comandos
              <MenubarShortcut>Ctrl+Shift+P</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem className="text-xs" onSelect={onToggleTerminal}>
              {terminalOpen ? "Fechar terminal" : "Abrir terminal"}
              <MenubarShortcut>Ctrl+`</MenubarShortcut>
            </MenubarItem>
            <MenubarItem className="text-xs" onSelect={() => onSetView("git")}>
              Controle de versão
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem className="text-xs" onSelect={onToggleZen}>
              {zenMode ? "Desativar modo zen" : "Ativar modo zen"}
              <MenubarShortcut>Ctrl+K Z</MenubarShortcut>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem className="text-xs" onSelect={() => onSetView("settings")}>
              Configurações
            </MenubarItem>
            <MenubarItem className="text-xs" onSelect={() => onSetView("keybindings")}>
              Atalhos de teclado
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="text-xs">Ajuda</MenubarTrigger>
          <MenubarContent>
            <MenubarItem className="text-xs" onSelect={() => onSetView("onboarding")}>
              Tour de boas-vindas
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem className="text-xs" onSelect={() => onSetView("about")}>
              Sobre o Adila IDE
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      {rootPath && (
        <span className="text-muted-foreground text-xs truncate flex-1 ml-2">{rootPath}</span>
      )}
    </header>
  );
}
