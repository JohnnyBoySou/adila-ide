# Adila IDE — Release Notes

<!--
Formato de cada release:

## v<semver> — <YYYY-MM-DD>[ (current)]

<conteúdo markdown da release>

---

A primeira release encontrada com a marca "(current)" (ou, na ausência dela,
a primeira do arquivo) é considerada a versão atual exibida na tela "About".
-->

## v0.1.0 — 2026-04-25 (current)

Primeira versão pública do Adila IDE. Esta versão estabelece a base da experiência de desenvolvimento com suporte a múltiplas linguagens, terminal integrado e controle de versão.

---

### Editor de código

- **Monaco Editor** com syntax highlighting para TypeScript, JavaScript, Go, Rust, Python, JSON, CSS, HTML, Markdown e mais de 20 outras linguagens
- **LSP (Language Server Protocol)** integrado para Go (`gopls`) e Rust (`rust-analyzer`) com diagnósticos, autocompletar e hover
- **Abas com drag-and-drop** — reordene abas arrastando; indicador visual de posição de drop
- Cursor, posição de linha/coluna e linguagem detectada exibidos na barra de status
- Destaque da linha atual, números de linha, word wrap, minimap e whitespace configuráveis

### Explorador de arquivos

- Navegação por árvore de diretórios com expansão/recolhimento
- Indicadores de status Git por arquivo (modificado, novo, ignorado)
- Arquivos recentes acessíveis no Welcome Page

### Terminal integrado

- Terminal PTY nativo com suporte a múltiplas sessões
- Clique em caminhos de arquivo no output para abrir no editor
- Posição do painel redimensionável verticalmente

### Controle de versão (Git)

- Visualização de arquivos modificados, staged e untracked
- Diff inline por arquivo
- Commit diretamente pela interface
- Log de commits com detalhes do autor e hash
- Branch atual exibida na barra de status
- **Integração com GitHub via Device Flow** — login com `Authorize Adila IDE` no navegador, criação e publicação de repositórios direto da IDE

### Paleta de comandos

- Acesso rápido a comandos via `Ctrl+Shift+P`
- Navegação por arquivos do workspace
- Ir para linha com `:`

### Configurações

- Interface de configurações em tela cheia com persistência via backend Go
- Temas do Monaco: claro, escuro, alto contraste
- Fonte, tamanho, tab size, minimap, word wrap e outros 10+ parâmetros
- Posição da sidebar (esquerda ou direita)

### Atalhos de teclado

- Tela dedicada com referência de todos os atalhos organizados por categoria
- `Ctrl+S` — salvar arquivo
- `` Ctrl+` `` — alternar terminal
- `Ctrl+Shift+P` — paleta de comandos

### Barra de status

- Branch Git atual com link para a visão de controle de versão
- Nome do arquivo ativo
- Status do servidor LSP com instalação em um clique
- Linguagem detectada, linha e coluna do cursor
- Central de notificações

### Onboarding

- Fluxo guiado em primeiro uso: boas-vindas → tema → instalar CLI → conectar GitHub → abrir pasta

---

### Notas técnicas

- Construído com [Wails](https://wails.io) (Go + React)
- Frontend: React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- Editor: Monaco Editor 4.7 via `@monaco-editor/react`
- Terminal: node-pty via Go PTY nativo
- Configurações persistidas em JSON no diretório de dados do usuário
