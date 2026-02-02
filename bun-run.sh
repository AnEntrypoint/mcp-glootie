#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Exit handler
cleanup() {
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Error occurred${NC}" >&2
  fi
}
trap cleanup EXIT

# Check prerequisites
if ! command -v bun &> /dev/null; then
  echo -e "${RED}✗ Bun is required but not installed${NC}" >&2
  echo "Install from: https://bun.sh" >&2
  exit 1
fi

if ! command -v curl &> /dev/null; then
  echo -e "${RED}✗ curl is required but not installed${NC}" >&2
  exit 1
fi

if ! command -v tar &> /dev/null; then
  echo -e "${RED}✗ tar is required but not installed${NC}" >&2
  exit 1
fi

# Use safe hidden folder in home directory
INSTALL_DIR="${HOME}/.mcp-glootie"
echo -e "${GREEN}Installing to: $INSTALL_DIR${NC}"

# Create or update installation
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Download and extract (with retry logic)
MAX_RETRIES=3
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  if curl -fsSL https://github.com/AnEntrypoint/mcp-glootie/archive/main.tar.gz | tar xz 2>/dev/null; then
    break
  fi
  RETRY=$((RETRY + 1))
  if [ $RETRY -lt $MAX_RETRIES ]; then
    echo "Retry $RETRY/$MAX_RETRIES..." >&2
    sleep 2
  fi
done

if [ $RETRY -eq $MAX_RETRIES ]; then
  echo -e "${RED}✗ Failed to download from GitHub${NC}" >&2
  exit 1
fi

# Enter extracted directory
cd mcp-glootie-main

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
bun install --frozen-lockfile || {
  echo -e "${RED}✗ Dependency installation failed${NC}" >&2
  exit 1
}

# Run server
echo -e "${GREEN}✓ Starting MCP Glootie${NC}"
exec bun run src/index.js
