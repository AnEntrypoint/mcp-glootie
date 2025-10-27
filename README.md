[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/anentrypoint-mcp-glootie-badge.png)](https://mseep.ai/app/anentrypoint-mcp-glootie)

![cd6d6b01e938ef486734ce8dd2544ae5-1](https://github.com/user-attachments/assets/c080416f-5fa3-44d0-aa36-8aa2cac0a7d2)

MCP (Model Context Protocol) server for development tools with optimized execution and vector embeddings.

The aim of the current version is to make more thoroughly investigated outputs than regular tooling, which will save you on rounds of physical interaction with the agent

benchmark prompt:

``` always use glootie ```

my preferred prompts look somethinig like:

```always continuously track and update caveats with the caveat tool, always hypothesize and test ideas in glootie and playwright execute first before implementing them, only implment when you're sure something will work, use the tooling to always eliminate double implementations, DRY code is mandatory, generalization is mandatory, architectural foresight is mandatory, immediately implement changes that should be made across the board, use the code insight tools in glootie to improve your ourput and immediately fix anything that goes against policy, a stitch in time saves nine. use ast-grep for codebase wide pattern base replaces etc whenever needed, dont make any comments always eliminate any coments you see immediatley, dont make any mocks simulations fallbacks or failovers, our code must only have one primary implementation per concern, keep specs in specs/ and track their progress, you are not finished till all specs are recorded, tracked, all the parts of the codebase they use noted, end to end verified, and caveats recorded, never report further problems and finish, if they can be solved track them troubleshoot and iterate until they're fixed, if any problems warnings issues or errors or unexpected behaviors are encountered track them immediately and treat the solving of all known errors as a hard barrier that prevents you from finishing, you may only finish when all known issues are fully end-to-end verified to be resolved, that means that as a final step you must do a full error discovery run to find further issues and check the entire project to make sure it works as expected, end to end, tracking any new issues found immediately and iterating on troubleshooting them till an entire run of all the program features are fully end to end tested and known to work, no exceptions. we want to apply frameworking foresight thoughout our work process so that generalizations, dryness, automated frameworking, convention over configuration and code minimization is always enforced, every letter counts. we want compehensive and easy to use globals for debugging in our code and often use them in our code executions as possible, to get absolute truth on whats going on when fixing problems, we should never ever guess when changing code, first principals only.```

## Features

### Available Tools

#### Core Tools
- **begin** - Initialize the system and set working directory context
- **execute** - Multi-language code execution with automatic runtime detection
  - **JavaScript/TypeScript** - Execute with Node.js or Deno
  - **Go** - Execute with `go run` (when Go CLI available)
  - **Rust** - Compile and execute with `rustc` (when Rust CLI available)
  - **Python** - Execute with `python3` (when Python CLI available)
  - **C** - Compile and execute with `gcc` (when GCC available)
  - **C++** - Compile and execute with `g++` (when G++ available)
  - **Bash** - Run bash commands securely

#### Analysis Tools
- **searchcode** - Semantic code search with AI-powered vector embeddings across all supported languages
- **ast_tool** - Unified AST operations combining code analysis, pattern search, safe replacement, and linting

#### Execution Tools
- **execute** - Multi-language code execution with built-in async job management and progress tracking

#### Utility Tools
- **caveat** - Record, view, and delete technological caveats encountered during development. Important for tracking limitations, constraints, and considerations that inform future work.
- **error_handling** - Enhanced error recovery and reporting
- **utilities** - Common utility functions and helpers
- **mcp_pagination** - MCP pagination utilities for handling large datasets


### Language Runtime Requirements

For full multi-language support, install the following CLI tools:

- **Go**: `go` - Install from https://golang.org/
- **Rust**: `rustc` and `cargo` - Install from https://rustup.rs/
- **Python**: `python3` - Usually pre-installed on Linux/macOS
- **C**: `gcc` - Install build-essential or Xcode Command Line Tools
- **C++**: `g++` - Included with gcc installation
- **Node.js**: `node` (≥16.0.0) - Install from https://nodejs.org/
- **Deno**: `deno` - Install from https://deno.land/

**Note**: The tools automatically detect which language runtimes are available and enable features accordingly.

## Client Configuration

### Claude Code

#### Windows
On Windows, npx commands require the `cmd /c` wrapper:
```bash
claude mcp add glootie -- cmd /c npx -y mcp-glootie@latest
```

#### macOS/Linux
```bash
# Using npx (recommended - always gets latest version)
claude mcp add glootie npx -s local -- -y mcp-glootie@latest

# For local development (replace /path/to with actual path)
claude mcp add glootie -- node /path/to/mcp-glootie/src/index.js
```

### Cursor
Add to your Cursor `mcpServers.json` configuration:
```json
{
  "mcpServers": {
    "glootie": {
      "command": "npx",
      "args": ["-y","mcp-glootie@latest"],
      "env": {},
      "disabled": false,
      "autoApprove": [
        "execute",
        "searchcode",
        "ast_tool",
        "caveat"
      ]
    }
  }
}
```

### GitHub Copilot
Add to your GitHub Copilot `mcpServers.json` configuration:
```json
{
  "mcpServers": {
    "glootie": {
      "command": "npx",
      "args": ["-y","mcp-glootie@latest"],
      "env": {},
      "type": "local",
      "tools": [
        "execute",
        "searchcode",
        "ast_tool",
        "caveat"
      ]
    }
  }
}
```

### VSCode
Add to your VSCode MCP configuration:
```json
{
    "servers": {
        "glootie": {
            "command": "npx",
            "args": ["-y","mcp-glootie@latest"],
            "env": {},
            "type": "stdio"
        }
    },
    "inputs": []
}
```

**Note**: For Claude Code local development, replace `/path/to/mcp-glootie` with the actual path to your cloned repository. The global installation uses the `mcp-glootie` command directly.


## Tools

### Core AST Tools

#### ast_tool
Unified AST operations combining code analysis, pattern search, safe replacement, and linting in one powerful tool. This consolidates the previous 4 separate AST tools to reduce choice paralysis and provide a consistent interface.

**Operations:**
- **analyze** - Parse code structure, count functions/classes/imports, validate syntax
- **search** - Find structural code patterns using AST matching with wildcards
- **replace** - Safely transform code patterns while preserving syntax
- **lint** - Apply custom linting rules using AST patterns

**Key Features:**
- Single unified interface for all AST operations
- Intelligent file reading (accepts either code or filePath)
- Multi-language support (JavaScript, TypeScript, Go, Rust, Python, C, C++)
- Advanced ast-grep pattern matching with YAML configuration support
- Relational constraints and composite rule types
- Automatic ignore pattern filtering
- Advanced pattern syntax with wildcards ($VARIABLE)
- Safe AST-based transformations with automatic backups

**Examples:**
```javascript
// Analyze code structure
ast_tool(operation="analyze", path="./src", analysisType="detailed")

// Find React components
ast_tool(operation="search", pattern="const $NAME = ($PROPS) => { $BODY }")

// Replace console.log with logger
ast_tool(operation="replace", pattern="console.log($MSG)", replacement="logger.info($MSG)")

// Lint for code quality issues
ast_tool(operation="lint", path="./src", rules=[custom_rules])
```

**Common Patterns:**
```
function $NAME($ARGS) { $BODY }           # Find function declarations
const $NAME = ($PROPS) => { $BODY }        # Find React components
interface $NAME { $MEMBERS }              # Find TypeScript interfaces
console.log($ARGS)                       # Find console.log calls
var $NAME = $VALUE → let $NAME = $VALUE      # Convert var to let/const
```

### Execution Tools

#### execute
Execute code in multiple languages with automatic runtime detection and CLI tool integration.

#### batch_execute
Coordinate multiple tools in single operations for efficiency across different languages. Now supports intelligent file reading for AST operations.

**Key Improvements:**
- Automatic file reading when filePath provided without code
- Improved error handling and validation
- Better integration with AST tools

### Analysis Tools

#### searchcode
Search for code patterns across your multi-language codebase with semantic vector embeddings.

#### execute
Multi-language code execution with 3-second threshold optimization and cross-tool status sharing.

**Key Features:**
- **3-second threshold**: Fast operations (< 3 seconds) return direct responses to save cycles and latency
- **Cross-tool status sharing**: Execution results automatically shared with subsequent tool calls
- **Smart optimization**: Time-based execution tracking for optimal performance
- **Multi-language support**: JavaScript, TypeScript, Go, Rust, Python, C, C++, Bash
- **Status indicators**: Clear markers help agents track execution across tools

**Usage:**
```javascript
// Execute code (automatically optimized based on execution time)
execute(code="console.log('Hello world')", runtime="nodejs")

// Fast executions (< 3 seconds) return direct responses
// Status automatically shared with subsequent tool calls
```

#### sequentialthinking
Structure complex thoughts systematically for better analysis.

#### caveat
Record, view, and delete technological caveats encountered during development. This tool helps track system limitations, constraints, and important considerations that inform future work.

**Features:**
- **Record caveats**: Document technological limitations, API constraints, performance considerations
- **View caveats**: Display all recorded caveats with timestamps for easy reference
- **Delete caveats**: Remove caveats that are no longer relevant or have been resolved
- **Persistent storage**: Caveats are stored locally and displayed during MCP initialization
- **Informative context**: Caveats help agents understand project constraints and limitations

**Usage:**
```javascript
// Record a new caveat
caveat(action="record", text="This API endpoint has rate limiting of 100 requests per minute")

// View all caveats
caveat(action="view")

// Delete a caveat by ID or text
caveat(action="delete", id="cav_1234567890123_abcde")
```

**Important:** The caveat tool displays recorded caveats during MCP server initialization to inform future work. Use it to document any technological limitations that could impact development decisions.

## Testing

The project includes a comprehensive performance testing suite (`test-runner.cjs`) that:

- **Parallel Testing**: Runs baseline vs MCP-optimized tests simultaneously
- **Real-time Monitoring**: Incremental file writing prevents stuck processes
- **Comprehensive Analysis**: Tracks tool usage, performance metrics, and MCP server status
- **Automatic Reporting**: Generates detailed analysis reports and suggestions

### Test Runner Features

- **Optimized Incremental File Writing**: Step data written every 25 operations for better performance
- **Process Monitoring**: Real-time updates during test execution
- **Working Directory Fixes**: Critical fix for analyzing correct codebase instead of parent directories
- **Error Recovery**: Graceful handling of failed tests with detailed error reporting
- **Performance Metrics**: Measures speed improvements and tool effectiveness
- **Status Tracking**: Proper MCP server status tracking for baseline vs MCP tests

Run tests with:
```bash
node test-runner.cjs
```

## Architecture

- Clean, simple implementation following KISS principles
- Minimal dependencies and straightforward code structure
- Future-proof design with clear separation of concerns
- Focus on essential functionality without unnecessary complexity
- Robust testing infrastructure with incremental progress tracking

## License

MIT
