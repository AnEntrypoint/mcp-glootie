#!/usr/bin/env bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

# Detect if running from cloned repository
if [ -f "src/index.js" ] && [ -f "package.json" ]; then
  echo -e "${YELLOW}Running from source directory${NC}"
  WORK_DIR="."
else
  # Install to home directory
  WORK_DIR="${HOME}/.mcp-glootie"
  echo -e "${GREEN}Installing to: $WORK_DIR${NC}"

  # Create directory
  mkdir -p "$WORK_DIR"
  cd "$WORK_DIR"

  # Download and extract (with retry logic)
  MAX_RETRIES=3
  RETRY=0

  # First check if we already have a valid installation
  if [ ! -f "src/index.js" ] || [ ! -f "package.json" ]; then
    while [ $RETRY -lt $MAX_RETRIES ]; do
      # Use temp file instead of process substitution for MCP compatibility
      TEMP_TAR=$(mktemp /tmp/mcp-glootie.XXXXXX.tar.gz)
      if curl -fsSL https://github.com/AnEntrypoint/mcp-glootie/archive/main.tar.gz -o "$TEMP_TAR" 2>/dev/null && \
         tar xzf "$TEMP_TAR" 2>/dev/null && \
         rm -f "$TEMP_TAR"; then
        # Move extracted files to current directory
        if [ -d "mcp-glootie-main" ]; then
          mv mcp-glootie-main/* . 2>/dev/null || true
          rmdir mcp-glootie-main 2>/dev/null || true
        fi
        break
      fi

      # Cleanup temp file if extraction failed
      [ -f "$TEMP_TAR" ] && rm -f "$TEMP_TAR"

      RETRY=$((RETRY + 1))
      if [ $RETRY -lt $MAX_RETRIES ]; then
        echo -e "${YELLOW}Retry $RETRY/$MAX_RETRIES...${NC}" >&2
        sleep 2
      fi
    done

    if [ $RETRY -eq $MAX_RETRIES ]; then
      echo -e "${RED}✗ Failed to download from GitHub${NC}" >&2
      exit 1
    fi
  else
    echo -e "${GREEN}Found existing installation${NC}"
  fi
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
bun install --frozen-lockfile || {
  echo -e "${RED}✗ Dependency installation failed${NC}" >&2
  exit 1
}

# Run server
echo -e "${GREEN}✓ Starting MCP Glootie${NC}"
bun run src/index.js
