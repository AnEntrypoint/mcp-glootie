# Simple JS REPL
[![smithery badge](https://smithery.ai/badge/@AnEntrypoint/mcp-repl)](https://smithery.ai/server/@AnEntrypoint/mcp-repl)

A secure JavaScript REPL (Read-Eval-Print-Loop) for executing code snippets with comprehensive error handling, memory management, and output formatting.

## Features

- **Secure Execution Environment**: Runs JavaScript code in a sandboxed VM context
- **Memory Limit Protection**: Prevents memory-intensive operations from crashing the server
- **Timeout Handling**: Automatically terminates long-running operations
- **Comprehensive Error Reporting**: Detailed error messages with stack traces
- **Console Output Capture**: Captures and formats all console methods (log, error, warn, etc.)
- **Support for Async/Await**: Execute asynchronous code with top-level await
- **Node.js Module Access**: Import and use Node.js built-in modules securely
- **Working Directory Support**: Specify a working directory via argv[2]

## Quick Start with npx

Run the REPL without installing it:

```bash
npx mcp-repl
```

This will start an interactive REPL where you can enter JavaScript code:

```
> return 2 + 2
--- No Console Output ---

--- Result ---
4
------------
```

You can also execute code directly:

```bash
npx simple-js-repl "console.log('Hello world'); return 42"
```

Or pipe code into it:

```bash
echo "return new Date().toISOString()" | npx simple-js-repl
```

### Specifying Working Directory

You can specify a working directory for the REPL to use:

```bash
npx simple-js-repl /path/to/working/directory
```

All code will be executed with this directory as the current working directory.

## Installation

### Installing via Smithery

To install Simple JavaScript REPL for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@AnEntrypoint/mcp-repl):

```bash
npx -y @smithery/cli install @AnEntrypoint/mcp-repl --client claude
```

### Manual Installation
If you want to install the package globally:

```bash
npm install -g simple-js-repl
```

After installation, you can use it as:

```bash
js-repl
```

## CLI Usage

```
Simple JavaScript REPL - Secure code execution environment

Usage:
  $ npx simple-js-repl
  $ npx simple-js-repl "console.log('Hello, World!')"
  $ echo "return 2 + 2" | npx simple-js-repl

Options:
  --help, -h    Show this help message
  --version, -v Show version number
```

## API Usage

The REPL server exposes a single MCP tool called `execute` that accepts JavaScript code as input and returns the execution result along with any console output.

Example MCP request:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tool",
  "params": {
    "name": "execute",
    "arguments": {
      "code": "return 2 + 2;"
    }
  }
}
```

Example response:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "--- No Console Output ---\n\n--- Result ---\n4\n------------"
      }
    ],
    "isError": false
  }
}
```

## Testing

The package includes comprehensive test suites:

```bash
# Run all tests
npm test
```

## Security

The REPL runs code in a secure sandboxed environment with:

- Restricted access to sensitive modules (fs, child_process, etc.)
- Memory usage monitoring and limits
- Execution timeouts
- Proper error isolation and reporting

## License

MIT
