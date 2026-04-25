#!/bin/bash
# Dev server — passa -tags webkit2_41 no Linux (webkit2gtk 4.1 é padrão em Ubuntu 24.04+).

TAGS=""
if [[ "$(uname -s)" == "Linux" ]]; then
  TAGS="-tags webkit2_41"
fi
exec wails dev $TAGS "$@"
