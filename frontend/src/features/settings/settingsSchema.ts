import { THEMES } from "@/lib/themes";
import type { SettingActionId } from "./actions";

export type SettingType =
  | "boolean"
  | "string"
  | "number"
  | "enum"
  | "color"
  | "string-list"
  | "action";

export interface SettingDef {
  key: string;
  title: string;
  description?: string;
  type: SettingType;
  defaultValue: unknown;
  options?: { value: string; label: string }[];
  keywords?: string[];
  actionId?: SettingActionId;
  actionLabel?: string;
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
    title: "Aparência",
    description:
      "Tema, tipografia e densidade. O tema afeta toda a interface, incluindo o editor Monaco.",
    settings: [
      {
        key: "workbench.colorTheme",
        title: "Tema",
        description:
          "Tema completo do sistema. Atualiza painéis React, sidebar, status bar e o editor Monaco.",
        type: "enum",
        defaultValue: "Default Dark Modern",
        options: THEMES.filter((t) => t.id !== "Custom").map((t) => ({
          value: t.id,
          label: t.label,
        })),
        keywords: [
          "tema",
          "theme",
          "cores",
          "dark",
          "light",
          "dracula",
          "nord",
          "tokyo",
          "catppuccin",
          "monokai",
          "gruvbox",
          "github",
          "solarized",
        ],
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
      {
        key: "adila.appearance.transparency",
        title: "Janela translúcida",
        description:
          "Ativa fundo translúcido com efeito blur, deixando o wallpaper visível através da UI. Requer suporte a transparência no compositor (Mutter, KWin, Picom etc.).",
        type: "boolean",
        defaultValue: false,
        keywords: ["transparency", "blur", "vidro", "translucent", "acrylic", "wallpaper"],
      },
      {
        key: "adila.appearance.transparencyOpacity",
        title: "Opacidade do fundo",
        description: "Quanto menor, mais transparente. Entre 0.2 e 1.0.",
        type: "number",
        defaultValue: 0.85,
        keywords: ["transparency", "opacity", "alpha"],
      },
      {
        key: "adila.appearance.transparencyBlur",
        title: "Intensidade do blur",
        description: "Em pixels. 0 desativa o blur. Valores típicos: 16–32.",
        type: "number",
        defaultValue: 24,
        keywords: ["blur", "transparency", "vidro"],
      },
    ],
  },
  {
    id: "appearance",
    title: "Workbench",
    description: "Layout geral e painéis.",
    settings: [
      {
        key: "workbench.iconTheme",
        title: "Tema de ícones",
        description: "Conjunto de ícones de arquivos e pastas no explorer/abas/git.",
        type: "enum",
        defaultValue: "symbols",
        options: [
          { value: "symbols", label: "Symbols (Miguel Solorio)" },
          { value: "minimal", label: "Minimal (Lucide)" },
        ],
        keywords: ["icones", "tema", "arquivos", "explorer", "lucide", "symbols"],
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
      {
        key: "editor.cursorSmoothCaretAnimation",
        title: "Animação do cursor",
        description: "Movimento interpolado entre posições do cursor.",
        type: "enum",
        defaultValue: "on",
        options: [
          { value: "off", label: "Desligado" },
          { value: "explicit", label: "Apenas em saltos" },
          { value: "on", label: "Sempre" },
        ],
        keywords: ["cursor", "caret", "animação", "smooth"],
      },
      {
        key: "editor.bracketPairColorization.enabled",
        title: "Colorir pares de parênteses",
        description: "Pinta cada nível de () [] {} com uma cor diferente.",
        type: "boolean",
        defaultValue: true,
        keywords: ["bracket", "parênteses", "colorização", "rainbow"],
      },
      {
        key: "editor.guides.bracketPairs",
        title: "Guias de parênteses",
        description: "Linha vertical conectando parênteses pareados.",
        type: "enum",
        defaultValue: "active",
        options: [
          { value: "off", label: "Desligado" },
          { value: "active", label: "Apenas o ativo" },
          { value: "always", label: "Sempre" },
        ],
        keywords: ["bracket", "guides", "parênteses"],
      },
      {
        key: "editor.guides.indentation",
        title: "Guias de indentação",
        description: "Linhas verticais nos níveis de indentação.",
        type: "boolean",
        defaultValue: true,
        keywords: ["indent", "guides", "indentação"],
      },
      {
        key: "editor.stickyScroll.enabled",
        title: "Sticky scroll",
        description: "Mantém o cabeçalho do escopo (function/class/if) fixo no topo do editor.",
        type: "boolean",
        defaultValue: true,
        keywords: ["sticky", "scroll", "scope", "escopo"],
      },
      {
        key: "editor.fontLigatures",
        title: "Ligaduras de fonte",
        description:
          "Combina caracteres como `=>`, `!=`, `>=` em glifos únicos (requer fonte com ligaduras).",
        type: "boolean",
        defaultValue: true,
        keywords: ["ligatures", "fonte", "ligaduras", "fira", "jetbrains"],
      },
      {
        key: "editor.mouseWheelZoom",
        title: "Zoom com Ctrl+Scroll",
        description: "Permite ajustar o tamanho da fonte com Ctrl + roda do mouse.",
        type: "boolean",
        defaultValue: false,
        keywords: ["zoom", "scroll", "wheel", "fonte"],
      },
      {
        key: "editor.linkedEditing",
        title: "Edição vinculada de tags",
        description: "Renomeia automaticamente a tag pareada ao editar HTML/JSX.",
        type: "boolean",
        defaultValue: true,
        keywords: ["linked", "editing", "tag", "html", "jsx"],
      },
      {
        key: "editor.formatOnPaste",
        title: "Formatar ao colar",
        type: "boolean",
        defaultValue: false,
        keywords: ["format", "paste", "colar"],
      },
      {
        key: "editor.formatOnType",
        title: "Formatar ao digitar",
        description: "Aplica formatação enquanto você digita (depende do LSP).",
        type: "boolean",
        defaultValue: false,
        keywords: ["format", "type", "digitar"],
      },
      {
        key: "editor.inlayHints.enabled",
        title: "Inlay hints",
        description: "Mostra dicas inline de tipos e nomes de parâmetros (do LSP).",
        type: "enum",
        defaultValue: "on",
        options: [
          { value: "on", label: "Ligado" },
          { value: "off", label: "Desligado" },
          { value: "onUnlessPressed", label: "Esconder ao pressionar Ctrl+Alt" },
          { value: "offUnlessPressed", label: "Mostrar ao pressionar Ctrl+Alt" },
        ],
        keywords: ["inlay", "hints", "tipos", "parâmetros"],
      },
      {
        key: "editor.codeLens",
        title: "Code lens",
        description: 'Links "References" / "Implementations" acima de funções e classes.',
        type: "boolean",
        defaultValue: true,
        keywords: ["codelens", "references", "lens"],
      },
      {
        key: "editor.padding.top",
        title: "Padding superior",
        description: "Espaço em pixels no topo do editor.",
        type: "number",
        defaultValue: 12,
        keywords: ["padding", "espaço", "top"],
      },
      {
        key: "editor.gitGutter",
        title: "Git gutter",
        description:
          "Marca linhas adicionadas, modificadas e removidas ao lado dos números de linha.",
        type: "boolean",
        defaultValue: true,
        keywords: ["git", "gutter", "diff", "added", "modified", "deleted"],
      },
      {
        key: "editor.snippets.enabled",
        title: "Snippets embutidos",
        description:
          "Atalhos como `clog`, `useState`, `iferr` no autocomplete (TypeScript, JavaScript, Go).",
        type: "boolean",
        defaultValue: true,
        keywords: ["snippet", "atalho", "completion", "autocomplete"],
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
        key: "workbench.shortcutHud",
        title: "Exibir HUD de atalhos",
        description:
          "Mostra um indicador discreto na parte inferior da tela ao usar atalhos de teclado.",
        type: "boolean",
        defaultValue: true,
        keywords: ["shortcut", "hud", "atalho", "keybinding", "teclado", "indicador"],
      },
      {
        key: "window.confirmClose",
        title: "Confirmar antes de fechar",
        description: "Pede confirmação ao fechar a janela do Adila IDE.",
        type: "boolean",
        defaultValue: false,
        keywords: ["window", "fechar", "close", "exit", "quit", "confirmar"],
      },
      {
        key: "explorer.sortOrder",
        title: "Ordenação do explorer",
        description: "Como ordenar os arquivos e pastas na sidebar.",
        type: "enum",
        defaultValue: "name-asc",
        options: [
          { value: "name-asc", label: "Nome (A → Z)" },
          { value: "name-desc", label: "Nome (Z → A)" },
          { value: "recent", label: "Recentes primeiro" },
        ],
        keywords: ["sort", "ordem", "explorer", "alfabético"],
      },
      {
        key: "explorer.confirmDelete",
        title: "Confirmar exclusão",
        description: "Pede confirmação antes de apagar arquivos ou pastas pelo explorer.",
        type: "boolean",
        defaultValue: true,
        keywords: ["delete", "apagar", "explorer", "lixeira", "confirmar"],
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
  {
    id: "terminal",
    title: "Terminal",
    description: "Aparência e comportamento do terminal integrado.",
    settings: [
      {
        key: "terminal.fontFamily",
        title: "Fonte do terminal",
        description: "Nerd Fonts contêm glifos extras úteis pra prompts (powerline, devicons).",
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
        keywords: ["terminal", "fonte", "font", "nerd", "powerline", "mono"],
      },
      {
        key: "terminal.fontSize",
        title: "Tamanho da fonte do terminal",
        type: "number",
        defaultValue: 13,
        keywords: ["terminal", "tamanho", "fonte"],
      },
      {
        key: "terminal.cursorStyle",
        title: "Estilo do cursor",
        type: "enum",
        defaultValue: "bar",
        options: [
          { value: "block", label: "Bloco" },
          { value: "underline", label: "Sublinhado" },
          { value: "bar", label: "Barra" },
        ],
        keywords: ["cursor", "terminal", "bloco", "underline"],
      },
      {
        key: "terminal.cursorBlink",
        title: "Cursor piscante",
        type: "boolean",
        defaultValue: true,
        keywords: ["cursor", "blink", "piscar", "terminal"],
      },
      {
        key: "terminal.scrollback",
        title: "Linhas de scrollback",
        description: "Quantas linhas de histórico o terminal mantém em memória.",
        type: "number",
        defaultValue: 20000,
        keywords: ["scrollback", "histórico", "buffer", "terminal"],
      },
    ],
  },
  {
    id: "search",
    title: "Busca",
    description: "Busca global em arquivos.",
    settings: [
      {
        key: "search.maxResults",
        title: "Máximo de resultados",
        description:
          "Limita quantos matches a busca global retorna. Valores altos reduzem a performance.",
        type: "number",
        defaultValue: 1000,
        keywords: ["search", "busca", "limite", "max", "resultados"],
      },
    ],
  },
  {
    id: "spotify",
    title: "Spotify",
    description:
      "Mini-player integrado para escutar música enquanto programa. Requer conta Premium.",
    settings: [
      {
        key: "adila.spotify.enabled",
        title: "Ativar mini-player",
        description:
          "Mostra um mini-player flutuante no canto inferior direito. A primeira vez abre o navegador para autenticar.",
        type: "boolean",
        defaultValue: false,
        keywords: ["spotify", "music", "musica", "player", "premium"],
      },
    ],
  },
  {
    id: "git",
    title: "Git",
    description: "Sincronização e integração com repositórios git.",
    settings: [
      {
        key: "git.autoFetch",
        title: "Auto fetch",
        description:
          "Roda `git fetch --prune` periodicamente em segundo plano para manter os refs do remote atualizados.",
        type: "boolean",
        defaultValue: false,
        keywords: ["git", "fetch", "auto", "remote", "sync"],
      },
      {
        key: "git.autoFetchPeriod",
        title: "Intervalo do auto fetch (segundos)",
        description: "Mínimo aplicado: 30 segundos.",
        type: "number",
        defaultValue: 300,
        keywords: ["git", "fetch", "intervalo", "período", "segundos"],
      },
    ],
  },
  {
    id: "developer",
    title: "Desenvolvedor",
    description: "Ferramentas de diagnóstico e profiling.",
    settings: [
      {
        key: "developer.showFps",
        title: "Mostrar FPS",
        description:
          "Exibe um contador de FPS no canto da janela para detectar gargalos de renderização.",
        type: "boolean",
        defaultValue: false,
        keywords: ["fps", "performance", "framerate", "diagnóstico", "developer"],
      },
      {
        key: "developer.profiler",
        title: "React Profiler",
        description:
          "Loga renders custosos (>5ms) no console com id, phase e duração. Use junto com React DevTools.",
        type: "boolean",
        defaultValue: false,
        keywords: ["profiler", "react", "performance", "render", "diagnóstico", "developer"],
      },
      {
        key: "developer.profilerThreshold",
        title: "Limite do profiler (ms)",
        description: "Renders mais rápidos que isso são ignorados pelo logger.",
        type: "number",
        defaultValue: 5,
        keywords: ["profiler", "threshold", "limite", "ms", "developer"],
      },
      {
        key: "developer.downloadProfile",
        title: "Baixar profile JSON",
        description:
          "Exporta os renders agregados desde que o profiler foi habilitado, com sumário por id e log completo de eventos.",
        type: "action",
        defaultValue: null,
        actionId: "downloadProfile",
        actionLabel: "Baixar JSON",
        keywords: ["download", "export", "profile", "json", "developer"],
      },
      {
        key: "developer.clearProfile",
        title: "Limpar sessão do profiler",
        description: "Descarta todos os renders capturados na memória.",
        type: "action",
        defaultValue: null,
        actionId: "clearProfile",
        actionLabel: "Limpar",
        keywords: ["clear", "limpar", "reset", "profile", "developer"],
      },
    ],
  },
  {
    id: "performance",
    title: "Desempenho",
    description:
      "Ajustes para acelerar a renderização em máquinas modestas ou repositórios grandes.",
    settings: [
      {
        key: "performance.ultraFast",
        title: "Modo ultra rápido",
        description:
          "Suprime ícones e ornamentos visuais (ex: ícones do explorador de arquivos) para reduzir custo de render. Use em projetos enormes ou quando o FPS estiver baixo.",
        type: "boolean",
        defaultValue: false,
        keywords: [
          "performance",
          "rápido",
          "ultrafast",
          "ícones",
          "icons",
          "leve",
          "lite",
          "explorer",
        ],
      },
    ],
  },
];

// Lowercased "haystack" for each SettingDef. Built lazily on first lookup
// and reused across keystrokes, since settingsGroups is module-level static.
const searchHaystacks = new WeakMap<SettingDef, string>();

function haystackFor(s: SettingDef): string {
  let h = searchHaystacks.get(s);
  if (h === undefined) {
    const kws = s.keywords;
    h =
      `${s.title} ${s.description ?? ""} ${s.key}${kws && kws.length > 0 ? ` ${kws.join(" ")}` : ""}`.toLowerCase();
    searchHaystacks.set(s, h);
  }
  return h;
}

export function filterGroups(groups: SettingsGroupDef[], query: string): SettingsGroupDef[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return groups;
  }
  const out: SettingsGroupDef[] = [];
  for (const group of groups) {
    const src = group.settings;
    let filtered: SettingDef[] | null = null;
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      if (haystackFor(s).includes(q)) {
        if (filtered === null) {
          filtered = [];
        }
        filtered.push(s);
      }
    }
    if (filtered !== null) {
      out.push({ ...group, settings: filtered });
    }
  }
  return out;
}
