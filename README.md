# Adila IDE

> O editor de código forjado para fullstack.
> Performance nativa, latência mínima e DX impecável — construído em Go para devs que escrevem stack inteira, do banco ao pixel.

**Beta público** · **disponível apenas para Linux nesta versão** (x86_64 / ARM)
> Suporte a macOS e Windows está planejado, mas ainda **não está incluído nesta release**.

---

## Por que Adila

- **Cold start em 142ms** — núcleo em Go, render nativo, indexação incremental, zero overhead de Electron. Abre projetos enormes sem travar.
- **Latência de teclado < 8ms** (p99, 120Hz). Command Center, multi-cursor inteligente e Go-to-Definition cross-stack.
- **1 binário, zero setup** — LSPs gerenciados, terminal integrado, Git/GitHub e file watcher já vêm afinados. Sem caçar 12 extensões na primeira semana.

## Recursos

- **Editor Monaco** com syntax highlighting para 20+ linguagens
- **LSP gerenciado** — `gopls`, `rust-analyzer`, `tsserver` e outros instalados sob demanda, com hot-reload em mudança de schema
- **Git nativo** — staging, diff inline, commit, log, stash, branches, grafo de commits
- **GitHub via Device Flow** — login com `Authorize Adila IDE` no navegador; criação e publicação de repositórios direto da IDE
- **Terminal multi-shell** — bash, zsh, fish, pwsh com integração de prompt e split panes
- **Command Center** — `Ctrl+Shift+P` para arquivos, símbolos, comandos e histórico de Git
- **Painéis redimensionáveis** com persistência de layout entre sessões
- **Configurações em tela cheia**, com paleta de busca dedicada (`Ctrl+K` dentro de Settings)

## Stack técnica

- **[Wails v2.12](https://wails.io/)** — Go + WebView nativo
- **[Go 1.23](https://go.dev/)** — backend, file watcher, LSP supervisor, PTY
- **[React 19](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** — frontend
- **[Vite 7](https://vitejs.dev/)** — bundler com HMR
- **[Tailwind CSS v4](https://tailwindcss.com/)** + **[shadcn/ui](https://ui.shadcn.com/)** — interface
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** — engine do editor
- **[Bun](https://bun.sh/)** — package manager e task runner
- **[oxlint](https://oxc.rs/) / [oxfmt](https://oxc.rs/)** — lint e format do frontend

## Desenvolvimento

Pré-requisitos: Go 1.23+, [Wails CLI](https://wails.io/docs/gettingstarted/installation), Bun, e libwebkit (Linux).

```bash
# clonar e instalar deps do frontend
cd frontend && bun install && cd ..

# rodar em dev (HMR + Wails)
bun run dev

# lint (Go + frontend)
bun run lint

# format (Go + frontend)
bun run fmt
```

## Build

> ⚠️ Esta versão é distribuída **somente para Linux**. Os scripts cross-platform existem para uso futuro, mas builds para macOS/Windows não são suportados oficialmente nesta release.

```bash
# plataforma atual (Linux)
bun run build

# linux explicitamente
bun run build:linux
```

Os binários gerados ficam em `build/bin/`.

### CLI `adila`

Instala um link em `~/.local/bin/adila` para abrir a IDE em qualquer pasta do terminal:

```bash
bun run install:cli
adila .   # abre a IDE na pasta atual
```

A CLI também pode ser instalada pela tela de onboarding ou por Settings → CLI.

## Estrutura do projeto

```
.
├── main.go                   # Entry point Wails
├── app.go                    # File system, search, watcher
├── git.go                    # Git: status, diff, commit, stash, graph, push
├── github.go                 # GitHub Device Flow + CreateAndPublish
├── lsp*.go                   # Supervisor de LSP por linguagem
├── terminal.go               # PTY multi-sessão
├── config.go                 # Persistência em ~/.config/adila/settings.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Layout principal
│   │   ├── components/       # UI compartilhada (shadcn)
│   │   ├── features/         # Editor, Git, Settings, Onboarding, About...
│   │   └── rpc/              # Camada Wails ↔ React
│   └── vite.config.ts
├── scripts/                  # Build/dev scripts cross-platform
├── RELEASES.md               # Changelog (fonte única, exibido na tela About)
└── wails.json
```

## Release notes

Histórico de versões em **[RELEASES.md](./RELEASES.md)** — também exibido dentro do app em **About → Release Notes**.

Versão atual: **v0.1.0** (2026-04-25).

## Licença

MIT.
