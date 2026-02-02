#!/usr/bin/env bash
set -e

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

cd "$TMP_DIR"

# Download and extract repo
curl -fsSL https://github.com/AnEntrypoint/mcp-glootie/archive/main.tar.gz | tar xz

cd mcp-glootie-main

# Install and run
bun install --frozen-lockfile
exec bun run src/index.js
