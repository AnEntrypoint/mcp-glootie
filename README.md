# mcp-glootie

MCP server for executing code in JavaScript/TypeScript, Python, Go, Rust, C, C++, and Deno. Includes process management, recovery mechanisms, and automatic cleanup.

## Quick Start

Just one command with Bun:

```bash
bunx mcp-glootie
```

That's it. Starts the MCP server immediately and connects to Claude Code or your MCP client.

### For Development

Clone and run locally:

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

Then run mcp-glootie again.

### Port conflicts

If the server fails to start with a port error:

```bash
# Find what's using the port
lsof -i :3001

# Kill it if needed
kill -9 <PID>
```
