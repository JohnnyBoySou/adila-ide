#!/bin/bash
# Production build (Wails v3) para a plataforma atual.
# Gera bindings, builda o frontend e linka o binário Go com -tags production.

set -e

if ! command -v wails3 >/dev/null 2>&1; then
  echo "wails3 não encontrado no PATH."
  echo "Instale com: go install github.com/wailsapp/wails/v3/cmd/wails3@latest"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-dev}"
TAGS="production"
if [[ "$(uname -s)" == "Linux" ]]; then
  TAGS="${TAGS},webkit2_41"
fi

echo "→ Generating bindings..."
wails3 generate bindings -ts -clean

echo "→ Building frontend..."
(cd frontend && bun install --frozen-lockfile && bun run build)

echo "→ Building backend (-tags ${TAGS}, version=${VERSION})..."
mkdir -p build/bin
go build -tags "${TAGS}" -trimpath \
  -ldflags "-s -w -X main.version=${VERSION}" \
  -o "build/bin/adila-ide" .

echo "✓ Build complete: build/bin/adila-ide"
