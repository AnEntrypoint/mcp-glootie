#!/bin/bash
cd /mnt/c/dev/mcp-repl
exec node src/direct-executor-server.js "$@"