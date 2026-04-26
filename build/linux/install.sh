#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BIN_DIR="${HOME}/.local/bin"
ICON_DIR="${HOME}/.local/share/icons/hicolor/512x512/apps"
DESKTOP_DIR="${HOME}/.local/share/applications"

mkdir -p "$BIN_DIR" "$ICON_DIR" "$DESKTOP_DIR"

echo "Instalando adila-ide em $BIN_DIR..."
install -m 755 "$SCRIPT_DIR/adila-ide" "$BIN_DIR/adila-ide"

echo "Instalando ícone..."
install -m 644 "$SCRIPT_DIR/adila-ide.png" "$ICON_DIR/adila-ide.png"

echo "Instalando atalho no lançador..."
sed "s|Exec=adila-ide|Exec=$BIN_DIR/adila-ide|" \
    "$SCRIPT_DIR/adila-ide.desktop" > "$DESKTOP_DIR/adila-ide.desktop"

# Atualiza o cache de ícones para o GNOME reconhecer imediatamente.
if command -v update-icon-caches &>/dev/null; then
    update-icon-caches "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
elif command -v gtk-update-icon-cache &>/dev/null; then
    gtk-update-icon-cache -f "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true
fi

# Notifica o ambiente de desktop sobre o novo .desktop file.
if command -v update-desktop-database &>/dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo ""
echo "Adila IDE instalado com sucesso!"
echo "  Binário : $BIN_DIR/adila-ide"
echo "  Atalho  : $DESKTOP_DIR/adila-ide.desktop"
echo ""
echo "Se $BIN_DIR não estiver no seu PATH, adicione ao ~/.bashrc ou ~/.profile:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
