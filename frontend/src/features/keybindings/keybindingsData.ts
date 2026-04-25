export type Keybinding = {
  id: string;
  title: string;
  description?: string;
  keys: string[][];
  when?: string;
};

export type KeybindingGroup = {
  id: string;
  title: string;
  bindings: Keybinding[];
};

export const keybindingGroups: KeybindingGroup[] = [
  {
    id: "general",
    title: "Geral",
    bindings: [
      {
        id: "command-palette",
        title: "Paleta de comandos",
        description: "Abre a paleta de comandos e busca de ações.",
        keys: [["Ctrl", "Shift", "P"]],
      },
      {
        id: "settings",
        title: "Abrir configurações",
        keys: [["Ctrl", ","]],
      },
      {
        id: "keybindings",
        title: "Atalhos de teclado",
        keys: [["Ctrl", "K"], ["Ctrl", "S"]],
      },
      {
        id: "open-folder",
        title: "Abrir pasta",
        keys: [["Ctrl", "K"], ["Ctrl", "O"]],
      },
    ],
  },
  {
    id: "editor",
    title: "Editor",
    bindings: [
      {
        id: "save",
        title: "Salvar arquivo",
        keys: [["Ctrl", "S"]],
        when: "Editor ativo",
      },
      {
        id: "save-all",
        title: "Salvar todos os arquivos",
        keys: [["Ctrl", "Shift", "S"]],
      },
      {
        id: "close-tab",
        title: "Fechar aba",
        keys: [["Ctrl", "W"]],
        when: "Editor ativo",
      },
      {
        id: "next-tab",
        title: "Próxima aba",
        keys: [["Ctrl", "Tab"]],
      },
      {
        id: "prev-tab",
        title: "Aba anterior",
        keys: [["Ctrl", "Shift", "Tab"]],
      },
      {
        id: "find",
        title: "Buscar no arquivo",
        keys: [["Ctrl", "F"]],
        when: "Editor ativo",
      },
      {
        id: "replace",
        title: "Substituir no arquivo",
        keys: [["Ctrl", "H"]],
        when: "Editor ativo",
      },
      {
        id: "find-all",
        title: "Buscar em todos os arquivos",
        keys: [["Ctrl", "Shift", "F"]],
      },
      {
        id: "go-to-line",
        title: "Ir para linha",
        keys: [["Ctrl", "G"]],
        when: "Editor ativo",
      },
      {
        id: "go-to-symbol",
        title: "Ir para símbolo",
        keys: [["Ctrl", "Shift", "O"]],
        when: "Editor ativo",
      },
      {
        id: "format-document",
        title: "Formatar documento",
        keys: [["Shift", "Alt", "F"]],
        when: "Editor ativo",
      },
      {
        id: "toggle-comment",
        title: "Alternar comentário de linha",
        keys: [["Ctrl", "/"]],
        when: "Editor ativo",
      },
      {
        id: "block-comment",
        title: "Alternar comentário de bloco",
        keys: [["Shift", "Alt", "A"]],
        when: "Editor ativo",
      },
      {
        id: "indent",
        title: "Aumentar indentação",
        keys: [["Tab"]],
        when: "Editor ativo, seleção",
      },
      {
        id: "outdent",
        title: "Reduzir indentação",
        keys: [["Shift", "Tab"]],
        when: "Editor ativo, seleção",
      },
      {
        id: "move-line-up",
        title: "Mover linha acima",
        keys: [["Alt", "↑"]],
        when: "Editor ativo",
      },
      {
        id: "move-line-down",
        title: "Mover linha abaixo",
        keys: [["Alt", "↓"]],
        when: "Editor ativo",
      },
      {
        id: "copy-line-up",
        title: "Copiar linha acima",
        keys: [["Shift", "Alt", "↑"]],
        when: "Editor ativo",
      },
      {
        id: "copy-line-down",
        title: "Copiar linha abaixo",
        keys: [["Shift", "Alt", "↓"]],
        when: "Editor ativo",
      },
      {
        id: "delete-line",
        title: "Deletar linha",
        keys: [["Ctrl", "Shift", "K"]],
        when: "Editor ativo",
      },
      {
        id: "multi-cursor-click",
        title: "Adicionar cursor",
        keys: [["Alt", "Click"]],
        when: "Editor ativo",
      },
      {
        id: "select-all-occurrences",
        title: "Selecionar todas as ocorrências",
        keys: [["Ctrl", "Shift", "L"]],
        when: "Editor ativo",
      },
      {
        id: "add-next-occurrence",
        title: "Adicionar próxima ocorrência",
        keys: [["Ctrl", "D"]],
        when: "Editor ativo",
      },
      {
        id: "undo",
        title: "Desfazer",
        keys: [["Ctrl", "Z"]],
        when: "Editor ativo",
      },
      {
        id: "redo",
        title: "Refazer",
        keys: [["Ctrl", "Y"]],
        when: "Editor ativo",
      },
    ],
  },
  {
    id: "terminal",
    title: "Terminal",
    bindings: [
      {
        id: "toggle-terminal",
        title: "Alternar terminal",
        keys: [["Ctrl", "`"]],
      },
      {
        id: "new-terminal",
        title: "Novo terminal",
        keys: [["Ctrl", "Shift", "`"]],
      },
      {
        id: "clear-terminal",
        title: "Limpar terminal",
        keys: [["Ctrl", "K"]],
        when: "Terminal focado",
      },
      {
        id: "scroll-up",
        title: "Rolar para cima",
        keys: [["Shift", "PgUp"]],
        when: "Terminal focado",
      },
      {
        id: "scroll-down",
        title: "Rolar para baixo",
        keys: [["Shift", "PgDn"]],
        when: "Terminal focado",
      },
    ],
  },
  {
    id: "navigation",
    title: "Navegação",
    bindings: [
      {
        id: "go-back",
        title: "Voltar",
        keys: [["Alt", "←"]],
      },
      {
        id: "go-forward",
        title: "Avançar",
        keys: [["Alt", "→"]],
      },
      {
        id: "focus-sidebar",
        title: "Focar na barra lateral",
        keys: [["Ctrl", "0"]],
      },
      {
        id: "focus-editor",
        title: "Focar no editor",
        keys: [["Ctrl", "1"]],
      },
      {
        id: "toggle-sidebar",
        title: "Alternar barra lateral",
        keys: [["Ctrl", "B"]],
      },
      {
        id: "zoom-in",
        title: "Aumentar zoom",
        keys: [["Ctrl", "="]],
      },
      {
        id: "zoom-out",
        title: "Reduzir zoom",
        keys: [["Ctrl", "-"]],
      },
      {
        id: "zoom-reset",
        title: "Resetar zoom",
        keys: [["Ctrl", "0"]],
      },
    ],
  },
  {
    id: "git",
    title: "Controle de versão",
    bindings: [
      {
        id: "git-view",
        title: "Abrir controle de versão",
        keys: [["Ctrl", "Shift", "G"]],
      },
      {
        id: "git-commit",
        title: "Commit",
        keys: [["Ctrl", "Enter"]],
        when: "Git: campo de mensagem focado",
      },
    ],
  },
];

export function filterGroups(
  groups: KeybindingGroup[],
  query: string,
): KeybindingGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups
    .map((group) => ({
      ...group,
      bindings: group.bindings.filter((b) =>
        [b.title, b.description ?? "", b.when ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q),
      ),
    }))
    .filter((g) => g.bindings.length > 0);
}
