#!/bin/bash
# Build for Linux (amd64). Roda wails3 generate bindings + bun build + go build.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${VERSION:-dev}"

echo "→ Generating bindings..."
wails3 generate bindings -ts -clean

echo "→ Building frontend..."
(cd frontend && bun install --frozen-lockfile && bun run build)

echo "→ Building backend (linux/amd64)..."
mkdir -p build/bin
GOOS=linux GOARCH=amd64 CGO_ENABLED=1 \
  go build -tags production,webkit2_41 -trimpath \
  -ldflags "-s -w -X main.version=${VERSION}" \
  -o build/bin/adila-ide .

echo "✓ Build complete: build/bin/adila-ide"
