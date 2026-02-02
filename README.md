# mcp-glootie

MCP server for executing code in JavaScript/TypeScript, Python, Go, Rust, C, C++, and Deno. Includes process management, recovery mechanisms, and automatic cleanup.

## Quick Start

Just one command. That's it.

```bash
curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/bun-run.sh | bash
```

### What It Does

1. Downloads the latest code from GitHub (or uses existing installation)
2. Extracts and installs dependencies with Bun
3. Starts the MCP server immediately
4. Connects to Claude Code or your MCP client

Zero setup, works everywhere Bash and Bun are available. **MCP-compatible** - works reliably over MCP connections.

### Add to Claude Code

Copy this into your terminal to download and start the server:

```bash
curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/bun-run.sh | bash
```

The script prints your MCP connection string automatically. Just add it to your Claude Code config.

**Note:** This method is now MCP-compatible and works reliably in all environments, including over MCP connections.

### Alternative Installation Methods

If you don't have Bun installed:

```bash
# Using npm (requires Node.js)
npx mcp-glootie
```

For local development:

```bash
git clone https://github.com/AnEntrypoint/mcp-glootie.git
cd mcp-glootie
bun install
bun run src/index.js
```

## Features

- Multi-language code execution (JS/TS, Python, Go, Rust, C, C++, Deno)
- Process management with backgrounding support
- Automatic error recovery
- Built-in cleanup and resource limits
- Stdin write capability for interactive processes
- Status checking for background processes

## Tools Available

- `execute` - Run code in any supported language
- `bash` - Execute shell commands
- `process_status` - Check background process status
- `process_close` - Terminate a process
- `sleep` - Pause execution

## Troubleshooting

### Bun not installed

If you see `Bun is required but not installed`, install Bun:

```bash
curl -fsSL https://bun.sh | bash
```

Then run the mcp-glootie setup again.

### Using Node.js instead

If you prefer not to install Bun, use the npm version:

```bash
npx mcp-glootie
```

This requires Node.js 18+ but doesn't need Bun.

### Port conflicts

If the server fails to start with a port error:

```bash
# Find what's using the port
lsof -i :3001

# Kill it if needed
kill -9 <PID>
```
