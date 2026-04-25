export type SettingType = "boolean" | "string" | "number" | "enum" | "color" | "string-list";

export interface SettingDef {
  key: string;
  title: string;
  description?: string;
  type: SettingType;
  defaultValue: unknown;
  options?: { value: string; label: string }[];
  keywords?: string[];
}

export interface SettingsGroupDef {
  id: string;
  title: string;
  description?: string;
  settings: SettingDef[];
}

export const settingsGroups: SettingsGroupDef[] = [
  {
    id: "appearance-react",
    title: "Aparência (React Views)",
    description:
      "Tema, accent, tipografia e densidade dos painéis React (notificações, configurações, command center).",
    settings: [
      {
        key: "adila.appearance.theme",
        title: "Tema",
        description: "Modo claro, escuro ou seguir o sistema.",
        type: "enum",
        defaultValue: "dark",
        options: [
          { value: "auto", label: "Automático (sistema)" },
          { value: "light", label: "Claro" },
          { value: "dark", label: "Escuro" },
        ],
        keywords: ["dark", "light", "tema", "cores"],
      },
      {
        key: "adila.appearance.accent",
        title: "Cor de destaque",
        description: "Aplicada a botões primários, links e foco.",
        type: "color",
        defaultValue: "#f0a23c",
        keywords: ["accent", "primary", "destaque", "cor"],
      },
      {
        key: "adila.appearance.fontUi",
        title: "Fonte da interface",
        type: "enum",
        defaultValue: "google-sans-flex",
        options: [
          { value: "google-sans-flex", label: "Google Sans Flex" },
          { value: "system", label: "Sistema" },
        ],
        keywords: ["fonte", "font", "ui", "tipografia"],
      },
      {
        key: "adila.appearance.fontMono",
        title: "Fonte monoespaçada",
        description: "Usada em códigos e blocos de monoespaço dos painéis.",
        type: "enum",
        defaultValue: "google-sans-code",
        options: [
          { value: "google-sans-code", label: "Google Sans Code" },
          { value: "jetbrains-mono-nf", label: "JetBrains Mono NF" },
          { value: "fira-code-nf", label: "Fira Code NF" },
          { value: "cascadia-code-nf", label: "Cascadia Code NF" },
          { value: "hack-nf", label: "Hack NF" },
          { value: "geist-mono-nf", label: "Geist Mono NF" },
          { value: "meslo-lgs-nf", label: "Meslo LGS NF" },
          { value: "system", label: "Sistema" },
        ],
        keywords: [
          "fonte",
          "font",
          "mono",
          "code",
          "nerd",
          "jetbrains",
          "fira",
          "cascadia",
          "hack",
          "geist",
          "meslo",
        ],
      },
      {
        key: "adila.appearance.radius",
        title: "Raio dos cantos",
        description: "Arredondamento global dos componentes.",
        type: "enum",
        defaultValue: "lg",
        options: [
          { value: "sm", label: "Pequeno" },
          { value: "md", label: "Médio" },
          { value: "lg", label: "Grande" },
          { value: "xl", label: "Extra grande" },
        ],
        keywords: ["radius", "border", "cantos"],
      },
      {
        key: "adila.appearance.density",
        title: "Densidade",
        description: "Compacto reduz o tamanho base da fonte e espaçamentos.",
        type: "enum",
        defaultValue: "comfortable",
        options: [
          { value: "comfortable", label: "Confortável" },
          { value: "compact", label: "Compacto" },
        ],
        keywords: ["spacing", "tamanho", "compact"],
      },
    ],
  },
  {
    id: "appearance",
    title: "Aparência (Workbench)",
    description: "Tema, fonte e densidade do workbench legacy do VS Code.",
    settings: [
      {
        key: "workbench.colorTheme",
        title: "Tema de cores",
        description: "Tema principal do editor.",
        type: "string",
        defaultValue: "Default Dark Modern",
      },
      {
        key: "workbench.iconTheme",
        title: "Tema de ícones",
        description: "Conjunto de ícones da sidebar.",
        type: "string",
        defaultValue: "vs-seti",
      },
      {
        key: "editor.fontFamily",
        title: "Fonte do editor",
        description:
          "Fonte usada no Monaco Editor. Nerd Fonts incluem ícones para uso no terminal.",
        type: "enum",
        defaultValue: "'Google Sans Code', monospace",
        options: [
          { value: "'Google Sans Code', monospace", label: "Google Sans Code" },
          { value: "'JetBrains Mono NF', monospace", label: "JetBrains Mono NF" },
          { value: "'Fira Code NF', monospace", label: "Fira Code NF" },
          { value: "'Cascadia Code NF', monospace", label: "Cascadia Code NF" },
          { value: "'Hack NF', monospace", label: "Hack NF" },
          { value: "'Geist Mono NF', monospace", label: "Geist Mono NF" },
          { value: "'Meslo LGS NF', monospace", label: "Meslo LGS NF" },
        ],
        keywords: ["fonte", "font", "editor", "nerd", "mono", "jetbrains", "fira", "cascadia"],
      },
      {
        key: "editor.fontSize",
        title: "Tamanho da fonte",
        type: "number",
        defaultValue: 13,
      },
      {
        key: "window.zoomLevel",
        title: "Zoom da janela",
        description: "Fator de zoom aplicado a toda a interface.",
        type: "number",
        defaultValue: 0,
      },
    ],
  },
  {
    id: "editor",
    title: "Editor",
    description: "Comportamento e aparência do editor de código Monaco.",
    settings: [
      {
        key: "monaco.theme",
        title: "Tema do editor",
        description: "Tema de cores do Monaco Editor.",
        type: "enum",
        defaultValue: "vs-dark",
        options: [
          { value: "vs-dark", label: "Escuro" },
          { value: "vs", label: "Claro" },
          { value: "hc-black", label: "Alto contraste escuro" },
          { value: "hc-light", label: "Alto contraste claro" },
        ],
        keywords: ["tema", "theme", "monaco", "dark", "light", "cores"],
      },
      {
        key: "editor.tabSize",
        title: "Tamanho do tab",
        type: "number",
        defaultValue: 2,
      },
      {
        key: "editor.insertSpaces",
        title: "Inserir espaços em vez de tabs",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "editor.wordWrap",
        title: "Word wrap",
        description: "Como quebrar linhas longas.",
        type: "enum",
        defaultValue: "off",
        options: [
          { value: "off", label: "Desligado" },
          { value: "on", label: "Ligado" },
          { value: "wordWrapColumn", label: "Na coluna" },
          { value: "bounded", label: "Limitado pelo viewport" },
        ],
      },
      {
        key: "editor.lineNumbers",
        title: "Números de linha",
        type: "enum",
        defaultValue: "on",
        options: [
          { value: "on", label: "Visível" },
          { value: "off", label: "Oculto" },
          { value: "relative", label: "Relativo" },
        ],
        keywords: ["linha", "line", "number", "gutter"],
      },
      {
        key: "editor.minimap.enabled",
        title: "Minimap",
        description: "Exibe o minimap ao lado direito.",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "editor.renderLineHighlight",
        title: "Destacar linha atual",
        type: "enum",
        defaultValue: "all",
        options: [
          { value: "none", label: "Nenhum" },
          { value: "gutter", label: "Somente gutter" },
          { value: "line", label: "Somente linha" },
          { value: "all", label: "Linha e gutter" },
        ],
        keywords: ["highlight", "linha", "cursor", "destaque"],
      },
      {
        key: "editor.renderWhitespace",
        title: "Mostrar espaços em branco",
        type: "enum",
        defaultValue: "selection",
        options: [
          { value: "none", label: "Nunca" },
          { value: "boundary", label: "Fronteiras" },
          { value: "selection", label: "Seleção" },
          { value: "trailing", label: "Finais" },
          { value: "all", label: "Sempre" },
        ],
        keywords: ["whitespace", "espaço", "tab", "invisível"],
      },
      {
        key: "editor.smoothScrolling",
        title: "Rolagem suave",
        type: "boolean",
        defaultValue: true,
        keywords: ["scroll", "smooth", "animação"],
      },
      {
        key: "editor.scrollBeyondLastLine",
        title: "Rolar além da última linha",
        description: "Permite rolar o editor além do conteúdo.",
        type: "boolean",
        defaultValue: false,
        keywords: ["scroll", "padding", "fim"],
      },
      {
        key: "editor.formatOnSave",
        title: "Formatar ao salvar",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "editor.cursorBlinking",
        title: "Piscar do cursor",
        type: "enum",
        defaultValue: "smooth",
        options: [
          { value: "blink", label: "Piscando" },
          { value: "smooth", label: "Suave" },
          { value: "phase", label: "Fase" },
          { value: "expand", label: "Expandir" },
          { value: "solid", label: "Sólido" },
        ],
      },
    ],
  },
  {
    id: "files",
    title: "Arquivos",
    description: "Salvamento, encoding e watchers.",
    settings: [
      {
        key: "files.autoSave",
        title: "Salvamento automático",
        type: "enum",
        defaultValue: "off",
        options: [
          { value: "off", label: "Desligado" },
          { value: "afterDelay", label: "Após intervalo" },
          { value: "onFocusChange", label: "Ao perder foco" },
          { value: "onWindowChange", label: "Ao mudar de janela" },
        ],
      },
      {
        key: "files.autoSaveDelay",
        title: "Intervalo do auto save (ms)",
        type: "number",
        defaultValue: 1000,
      },
      {
        key: "files.trimTrailingWhitespace",
        title: "Remover espaços à direita",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "files.insertFinalNewline",
        title: "Inserir nova linha no fim",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "files.eol",
        title: "Fim de linha (EOL)",
        type: "enum",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "\n", label: "LF" },
          { value: "\r\n", label: "CRLF" },
        ],
      },
    ],
  },
  {
    id: "workbench",
    title: "Workbench",
    description: "Layout geral e painéis.",
    settings: [
      {
        key: "workbench.sideBar.location",
        title: "Posição da sidebar",
        type: "enum",
        defaultValue: "left",
        options: [
          { value: "left", label: "Esquerda" },
          { value: "right", label: "Direita" },
        ],
      },
      {
        key: "workbench.activityBar.location",
        title: "Activity bar",
        type: "enum",
        defaultValue: "default",
        options: [
          { value: "default", label: "Padrão" },
          { value: "top", label: "Topo" },
          { value: "bottom", label: "Base" },
          { value: "hidden", label: "Oculta" },
        ],
      },
      {
        key: "workbench.tree.indent",
        title: "Recuo da árvore",
        type: "number",
        defaultValue: 8,
      },
      {
        key: "breadcrumbs.enabled",
        title: "Breadcrumbs",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "workbench.zenMode",
        title: "Modo Zen",
        description:
          "Oculta a barra superior e a barra de status para uma experiência sem distrações.",
        type: "boolean",
        defaultValue: false,
        keywords: ["zen", "foco", "distração", "fullscreen", "ocultar"],
      },
      {
        key: "explorer.excludeFolders",
        title: "Pastas ocultas no explorer",
        description:
          "Lista de nomes de diretórios ignorados pelo file explorer, busca de arquivos e indexação. Separe por vírgula.",
        type: "string-list",
        defaultValue: [
          ".git",
          ".svn",
          ".hg",
          "node_modules",
          "vendor",
          "dist",
          "build",
          "out",
          "target",
          ".next",
          ".nuxt",
          "coverage",
          "__pycache__",
          ".cache",
          ".gradle",
          ".turbo",
          ".parcel-cache",
        ],
        keywords: [
          "exclude",
          "ignore",
          "ocultar",
          "hidden",
          "node_modules",
          "vendor",
          "dist",
          "explorer",
          "indexação",
        ],
      },
    ],
  },
];

export function filterGroups(groups: SettingsGroupDef[], query: string): SettingsGroupDef[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return groups;
  }
  return groups
    .map((group) => ({
      ...group,
      settings: group.settings.filter((s) =>
        [s.title, s.description ?? "", s.key, ...(s.keywords ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(q),
      ),
    }))
    .filter((g) => g.settings.length > 0);
}
