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

# 1. Cria AppDir com linuxdeploy + plugin GTK (sem empacotar ainda)
"$LINUXDEPLOY_BIN" \
  --appdir=AppDir \
  --executable="$BIN" \
  --desktop-file="$DESKTOP" \
  --icon-file="$ICON_TMP" \
  --plugin gtk

# 2. Injeta AppRun customizado com --install / --uninstall.
#    O GTK plugin renomeia AppRun → AppRun.wrapped e cria um novo AppRun.
#    Salvamos esse wrapper GTK como AppRun.gtk e colocamos nosso script na frente.
mv AppDir/AppRun AppDir/AppRun.gtk

cat > AppDir/AppRun << 'APPRUN_EOF'
#!/bin/bash
SELF="$(readlink -f "$0")"
APPDIR="$(dirname "$SELF")"

case "${1:-}" in
  --install)
    DESKTOP_DIR="$HOME/.local/share/applications"
    ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
    mkdir -p "$DESKTOP_DIR" "$ICON_DIR"
    cp "$APPDIR/adila-ide.desktop" "$DESKTOP_DIR/adila-ide.desktop"
    sed -i "s|^Exec=.*|Exec=$SELF %F|" "$DESKTOP_DIR/adila-ide.desktop"
    cp "$APPDIR/.DirIcon" "$ICON_DIR/adila-ide.png" 2>/dev/null || \
      find "$APPDIR/usr/share/icons" -name "adila-ide.png" -exec cp {} "$ICON_DIR/adila-ide.png" \; 2>/dev/null || true
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    gtk-update-icon-cache -f "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
    echo "Adila IDE instalado. Aparecerá na busca do sistema."
    exit 0
    ;;
  --uninstall)
    rm -f "$HOME/.local/share/applications/adila-ide.desktop"
    rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/adila-ide.png"
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    echo "Adila IDE removido da busca do sistema."
    exit 0
    ;;
esac

exec "$APPDIR/AppRun.gtk" "$@"
APPRUN_EOF
chmod +x AppDir/AppRun

# 3. Empacota com appimagetool
OUT_NAME="adila-ide-${VERSION}-x86_64.AppImage"
mkdir -p "$OUTDIR"
"$APPIMAGE_TOOL_AI" AppDir "$OUTDIR/$OUT_NAME"

rm -f "$ICON_TMP"
echo "AppImage: $OUTDIR/$OUT_NAME"
