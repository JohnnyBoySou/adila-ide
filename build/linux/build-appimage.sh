#!/usr/bin/env bash
# Empacota o binário Wails já construído (build/bin/adila-ide) como AppImage.
# Ferramentas: linuxdeploy + linuxdeploy-plugin-gtk (script) + appimagetool.
# Ref.: https://docs.appimage.org/packaging-guide/from-source/native-binaries.html
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

: "${VERSION:?Defina VERSION (ex.: 1.2.3 sem prefixo v)}"

BIN="${BIN:-build/bin/adila-ide}"
DESKTOP="${DESKTOP:-build/linux/adila-ide.desktop}"
SRC_ICON="${SRC_ICON:-build/appicon.png}"
OUTDIR="${OUTDIR:-dist}"

for f in "$BIN" "$DESKTOP" "$SRC_ICON"; do
  if [[ ! -f "$f" ]]; then
    echo "Arquivo obrigatório ausente: $f" >&2
    exit 1
  fi
done

export APPIMAGE_EXTRACT_AND_RUN="${APPIMAGE_EXTRACT_AND_RUN:-1}"
export ARCH="${ARCH:-x86_64}"

TOOL_ROOT="${LINUXDEPLOY_DIR:-$ROOT/.cache/linuxdeploy-tools}"
mkdir -p "$TOOL_ROOT"

fetch() {
  local dest="$1" url="$2"
  if [[ ! -s "$dest" ]]; then
    wget -q "$url" -O "$dest"
  fi
  chmod +x "$dest"
}

LINUXDEPLOY_BIN="$TOOL_ROOT/linuxdeploy-${ARCH}.AppImage"
fetch "$LINUXDEPLOY_BIN" "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-${ARCH}.AppImage"

GTK_PLUGIN="$TOOL_ROOT/linuxdeploy-plugin-gtk"
if [[ ! -s "$GTK_PLUGIN" ]]; then
  wget -qO "$GTK_PLUGIN" "https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh"
fi
chmod +x "$GTK_PLUGIN"

APPIMAGE_TOOL_AI="$TOOL_ROOT/appimagetool-${ARCH}.AppImage"
fetch "$APPIMAGE_TOOL_AI" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${ARCH}.AppImage"

APPIMAGE_TOOL_WRAPPER="$TOOL_ROOT/appimagetool"
if [[ ! -x "$APPIMAGE_TOOL_WRAPPER" ]]; then
  printf '%s\n' '#!/bin/sh' "exec \"\$(dirname \"\$0\")/appimagetool-${ARCH}.AppImage\" \"\$@\"" >"$APPIMAGE_TOOL_WRAPPER"
  chmod +x "$APPIMAGE_TOOL_WRAPPER"
fi

export PATH="$TOOL_ROOT:$PATH"

# linuxdeploy valida tamanhos de ícone; o appicon do projeto é 1024px — geramos 512px.
# O basename do PNG tem de coincidir com Icon= no .desktop (ex.: adila-ide.png).
ICON_NAME="$(grep -E '^Icon=' "$DESKTOP" | head -n1 | cut -d= -f2-)"
ICON_TMP="${TMPDIR:-/tmp}/${ICON_NAME}.png"
if command -v magick &>/dev/null; then
  magick "$SRC_ICON" -resize 512x512 "$ICON_TMP"
elif command -v convert &>/dev/null; then
  convert "$SRC_ICON" -resize 512x512 "$ICON_TMP"
else
  echo "Instale ImageMagick (magick ou convert) para redimensionar o ícone." >&2
  exit 1
fi

rm -rf AppDir
rm -f ./*.AppImage

"$LINUXDEPLOY_BIN" \
  --appdir=AppDir \
  --executable="$BIN" \
  --desktop-file="$DESKTOP" \
  --icon-file="$ICON_TMP" \
  --plugin gtk \
  --output appimage

shopt -s nullglob
built=(./*.AppImage)
shopt -u nullglob
if [[ "${#built[@]}" -ne 1 ]]; then
  echo "Esperava exatamente um .AppImage na raiz do projeto; encontrados: ${#built[@]}" >&2
  exit 1
fi

mkdir -p "$OUTDIR"
OUT_NAME="adila-ide-${VERSION}-x86_64.AppImage"
mv -f "${built[0]}" "$OUTDIR/$OUT_NAME"
rm -f "$ICON_TMP"
echo "AppImage: $OUTDIR/$OUT_NAME"
