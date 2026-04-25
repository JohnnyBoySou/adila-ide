#!/bin/bash
# Simple production build for current platform

echo "Building for production..."
TAGS=""
if [[ "$(uname -s)" == "Linux" ]]; then
  TAGS="-tags webkit2_41"
fi
wails build -clean $TAGS
echo "Build complete! Check build/bin/"
