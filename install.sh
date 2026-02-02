#!/bin/bash

# mcp-glootie installer - one-liner setup
# Usage: curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/install.sh | bash

set -e

REPO="AnEntrypoint/mcp-glootie"
BRANCH="main"
INSTALL_DIR="${HOME}/.local/lib/mcp-glootie"
BIN_DIR="${HOME}/.local/bin"

echo "Installing mcp-glootie..."

# Create directories
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Download latest release or main branch
RELEASE_URL="https://github.com/${REPO}/archive/${BRANCH}.tar.gz"
echo "Downloading from: $RELEASE_URL"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Download and extract
cd "$TEMP_DIR"
curl -fsSL "$RELEASE_URL" -o archive.tar.gz
tar xzf archive.tar.gz

# Move to install directory
EXTRACTED_DIR=$(ls -d */ | head -1)
cp -r "$EXTRACTED_DIR"* "$INSTALL_DIR/"

# Make main file executable
chmod +x "$INSTALL_DIR/src/index.js"

# Create symlink in bin directory
ln -sf "$INSTALL_DIR/src/index.js" "$BIN_DIR/glootie"

# Verify installation
if command -v bun &> /dev/null; then
  echo ""
  echo "Installation complete!"
  echo ""
  echo "Run with:"
  echo "  glootie"
  echo "  bun $INSTALL_DIR/src/index.js"
  echo "  node $INSTALL_DIR/src/index.js"
else
  echo ""
  echo "Installation complete!"
  echo ""
  echo "Run with:"
  echo "  glootie (if PATH includes ~/.local/bin)"
  echo "  node $INSTALL_DIR/src/index.js"
  echo ""
  echo "Note: Install 'bun' for better performance"
  echo "  https://bun.sh"
fi
