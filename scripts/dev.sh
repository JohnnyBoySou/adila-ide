#!/bin/bash
# Dev server (Wails v3). Sobe Vite + watcher Go via Taskfile e build/config.yml.
# Em Linux a build do Taskfile usa EXTRA_TAGS=webkit2_41 (webkit2gtk 4.1
# é padrão em Ubuntu 24.04+).

set -e

if ! command -v wails3 >/dev/null 2>&1; then
  echo "wails3 não encontrado no PATH."
  echo "Instale com: go install github.com/wailsapp/wails/v3/cmd/wails3@latest"
  exit 1
fi

exec wails3 dev -config ./build/config.yml "$@"
