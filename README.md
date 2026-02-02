# mcp-glootie

MCP server for executing code in JavaScript/TypeScript, Python, Go, Rust, C, C++, and Deno. Includes process management, recovery mechanisms, and automatic cleanup.

## Quick Start

### One Command - Always Latest

```bash
npx mcp-glootie
```

This runs directly from GitHub/npm registry, always gets the latest version, requires no installation, works everywhere.

### With Bun (recommended if Bun is installed)

```bash
bunx mcp-glootie
```

### Alternative Options

**Direct from GitHub with Node.js:**
```bash
node <(curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/src/index.js)
```

**Install globally:**
```bash
curl -fsSL https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/install.sh | bash
glootie
```

All options connect to Claude Code or any MCP client automatically and always run the latest version from the main branch.

## Add to Claude Code

```bash
claude mcp add glootie npx mcp-glootie
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
