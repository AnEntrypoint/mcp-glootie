# mcp-glootie

MCP server for executing code in JavaScript/TypeScript, Python, Go, Rust, C, C++, and Deno. Includes process management, recovery mechanisms, and automatic cleanup.

## Quick Start

### One Command - Pure Bash/Bun (No npm)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/bun-run.sh)
```

Downloads latest, installs dependencies, and runs. Works everywhere Bash and Bun are available. Zero local setup.

### Alternative: One Command - Node.js (Universal)

```bash
npx mcp-glootie
```

Runs directly from npm registry, always gets the latest version, requires no installation, works everywhere Node.js is available.

### With Bun Runtime (Local Setup)

```bash
# One-time setup
git clone --depth 1 https://github.com/AnEntrypoint/mcp-glootie.git ~/.mcp-glootie && cd ~/.mcp-glootie && bun install

# Then run
bun run ~/.mcp-glootie/src/index.js
```

Or install as a dependency:
```bash
bun add github:AnEntrypoint/mcp-glootie
bunx mcp-glootie
```

### Local Development

```bash
git clone https://github.com/AnEntrypoint/mcp-glootie.git
cd mcp-glootie
bun install
bun run src/index.js
```

All options connect to Claude Code or any MCP client automatically and run the latest version from the main branch.

## Add to Claude Code

### Using Node.js (npm)
```bash
claude mcp add glootie npx mcp-glootie
```

### Using Bun
```bash
# After installing locally (see Quick Start)
claude mcp add glootie bun run ~/.mcp-glootie/src/index.js
```

## Execution Methods Comparison

| Method | Setup Time | Runtime | Network | Best For |
|--------|-----------|---------|---------|----------|
| `bash <(curl ...)` | Instant | Bun | Always latest | Bash/Bun available, zero setup |
| `npx mcp-glootie` | Instant | Node.js | Always latest | Most platforms, Node.js everywhere |
| `bun run` (local) | ~15s (one-time) | Bun (faster) | Latest on each run | Bun users, speed critical |
| `bunx mcp-glootie` | ~5s (one-time) | Bun | Latest on each run | Bun users, simplicity |
| Local clone | ~15s (one-time) | Node/Bun | Local only | Development, offline work |

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

## Bun Execution Details

### Why Bun?
Bun is significantly faster than Node.js for starting and running this server. All methods work identically - choose based on your preference.

### Methods Tested & Working
1. **Local clone + bun run** - Fastest after setup (~15s one-time install)
2. **bunx from GitHub dependency** - Simplest for occasional use
3. **npx from npm** - Works everywhere, no Bun needed

### Common Bun Issues

**"Cannot find module" error:**
- Ensure you ran `bun install` in the cloned directory
- Check that `node_modules` directory exists
- Try: `rm -rf node_modules bun.lockb && bun install`

**Module resolution from raw GitHub URLs:**
- Bun cannot execute directly from `https://raw.githubusercontent.com/` URLs without dependencies
- Use the wrapper script: `bash <(curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/bun-run.sh)`
- Or use `npx mcp-glootie` for npm registry method

## Troubleshooting

**Port conflicts:**
```bash
# Find what's using port 3001
lsof -i :3001
# Kill it
kill -9 <PID>
```

**Wrong Bun version:**
- Requires Bun 1.0.0 or higher
- Check: `bun --version`
- Update: `bun upgrade`

**Module not installed:**
- Run `bun install` (or `npm install`) in the project directory
- This downloads the MCP SDK dependency
