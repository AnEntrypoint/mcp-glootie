# gm-exec

Code execution tool for MCP clients and CLI. Multi-language support (JS/TS, Python, Go, Rust, C, C++, Deno, Java, bash). Built on Bun with PM2-managed process isolation.

## MCP Server

Add to your MCP client config:

```json
{
  "mcpServers": {
    "gm-exec": {
      "command": "bunx",
      "args": ["gm-exec", "--mcp"]
    }
  }
}
```

Or install globally:

```bash
bun install -g gm-exec
gm-exec --mcp
```

## CLI

```bash
bunx gm-exec-cli exec --cwd=/app "console.log('hello')"
bunx gm-exec-cli bash --cwd=/app "npm install && npm test"
bunx gm-exec-cli exec --lang=python --cwd=/app "print('hello')"
bunx gm-exec-cli exec --file=script.js
```

### Commands

```
gm-exec-cli exec [options] <code>     Execute code (waits up to 15s, then backgrounds)
  --lang=<lang>                        nodejs (default), python, go, rust, c, cpp, java, deno
  --cwd=<dir>                          Working directory
  --file=<path>                        Read code from file

gm-exec-cli bash [--cwd=<dir>] <cmd>  Execute bash commands, same 15s ceiling

gm-exec-cli status <task_id>           Poll status + drain output of a background task
gm-exec-cli close <task_id>            Delete a background task

gm-exec-cli runner start               Start the runner manually (PM2, no autorestart)
gm-exec-cli runner stop                Stop the runner
gm-exec-cli runner status              Show runner PM2 status
```

### Background execution

Commands have a hard 15-second ceiling. If still running after that, the process is backgrounded and you get a task ID with monitoring instructions:

```
Backgrounded after 15s — task still running.
Task ID: task_3

Watch output:
  gm-exec-cli status task_3
  gm-exec-cli close task_3
  gm-exec-cli runner stop
```

The runner auto-starts before each command and auto-stops after — unless a task was backgrounded, in which case the runner stays alive until you explicitly stop it.

## Supported Languages

| Language | Runtime |
|----------|---------|
| JavaScript / TypeScript | Node.js / Bun |
| Python | python3 |
| Go | go run |
| Rust | rustc |
| C | gcc |
| C++ | g++ |
| Java | javac + java |
| Deno | deno run |
| bash / sh / zsh | shell |

## Requirements

- [Bun](https://bun.sh) ≥ 1.0

```bash
curl -fsSL https://bun.sh/install | bash
```
