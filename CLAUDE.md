# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP REPL is a Model Context Protocol (MCP) server that provides code execution, semantic code search, and comprehensive AST-based code analysis capabilities. It enables AI assistants to execute JavaScript/TypeScript code, perform intelligent code searches, and utilize powerful structural code analysis and transformation tools via ast-grep integration.

## Development Commands

### Basic Commands
- `npm start` - Run the MCP server with current directory as working directory
- `npm run dev` - Run the MCP server with `./test` directory as working directory
- `node src/direct-executor-server.js [working-directory]` - Run server with specific working directory

### Testing
- `node test-search-final.js` - Run the main code search functionality test
- No automated test suite - manual testing with actual MCP clients

### Installation as MCP Tool
- **Claude Code**: `claude mcp add repl "npx" "-y" "mcp-repl" "path/to/your/project"`
- **Direct execution**: `npx mcp-repl [working-directory]`

## Architecture

### Core Components

**MCP Server** (`src/direct-executor-server.js`):
- Main entry point providing seven MCP tools
- Handles stdio-based MCP protocol communication
- Manages working directory context and process lifecycle

**Semantic Search Engine** (`src/js-vector-indexer.js`):
- AI-powered code search using transformer embeddings
- AST-aware code chunking and relationship mapping
- Vector similarity + text matching hybrid scoring

**AST-grep Integration** (`src/astgrep-*.js`):
- Structural code search and transformation using AST patterns
- Rule-based code validation and linting
- Multi-language support with tree-sitter parsers
- Advanced pattern matching with meta-variables

### MCP Tools Provided

1. **`executenodejs`** - Execute JavaScript code with Node.js
   - Supports both ESM modules and CommonJS
   - Preserves working directory context
   - Optional `workingDirectory` parameter for execution context

2. **`executedeno`** - Execute TypeScript/JavaScript code with Deno
   - Full TypeScript support with type checking
   - Enhanced security with controlled permissions
   - Optional `workingDirectory` parameter for execution context

3. **`searchcode`** - Semantic code search with AI embeddings
   - Natural language query processing
   - Structural code understanding (functions, classes, methods)
   - Optional `workingDirectory` parameter to specify search scope

4. **`astgrep_search`** - Pattern-based structural code search
   - AST-aware pattern matching with meta-variables
   - Multi-language support via tree-sitter
   - Structural understanding beyond text matching

5. **`astgrep_replace`** - Code transformation and refactoring
   - Pattern-based code rewriting with meta-variable substitution
   - Safe code transformation with dry-run support
   - Structural refactoring capabilities

6. **`astgrep_lint`** - Rule-based code validation
   - YAML-based custom linting rules
   - Structural pattern detection for code quality
   - Custom rule enforcement and validation

7. **`astgrep_analyze`** - AST structure analysis and debugging
   - Pattern debugging and AST exploration
   - Meta-variable extraction and analysis
   - Code structure understanding and validation

### Working Directory Behavior

All MCP tools accept an optional `workingDirectory` parameter:
- When provided: Uses the specified directory for operation context
- When omitted: Falls back to the server's startup working directory
- Path validation ensures directories exist and are accessible

## Code Architecture Principles

### File Organization
- Maximum 110 lines per file to maintain readability
- Clean separation between execution and search functionality
- Modular design with clear responsibilities

### Error Handling
- Comprehensive error propagation with contextual information
- Debug mode support for detailed error logging
- Clear error messages for troubleshooting

### Configuration Philosophy
- Convention over configuration: Self-configuring with sensible defaults
- Configuration over code: Parameterized behavior, no hardcoded values
- Environment-aware: Respects `.gitignore` patterns and project structure

## Dependencies

### Essential Dependencies
- `@modelcontextprotocol/sdk` (^1.11.0) - Official MCP SDK for server implementation
- `@xenova/transformers` (^2.17.2) - ML transformers for semantic search embeddings
- `@ast-grep/napi` (^0.28.0) - AST-grep bindings for structural code analysis

### Development Environment
- **Node.js**: >=16.0.0 required
- **Package type**: ESM modules (`"type": "module"`)
- **Binary**: Executable via `npx mcp-repl`

## Key Implementation Details

### Code Execution
- Creates temporary files for ESM module execution
- Uses stdin piping for CommonJS execution
- Proper cleanup of temporary resources
- Working directory context preservation

### Semantic Search
- Self-configuring code index with automatic file discovery
- Transformer model loading with graceful fallback
- Hybrid scoring combining semantic similarity and text matching
- Real-time indexing with file system monitoring capability

### AST-based Analysis
- Structural pattern matching using abstract syntax trees
- Multi-language support via tree-sitter parsers
- Meta-variable extraction and code transformation
- Rule-based validation and custom linting capabilities

### Security Considerations
- Working directory validation to prevent path traversal
- Controlled child process execution with timeouts
- Proper resource cleanup and error boundaries

## Usage Patterns

### Hypothesis-Driven Debugging
The MCP tools are designed for iterative code testing and exploration:
1. Execute code hypotheses with `executenodejs`/`executedeno`
2. Search for similar patterns with `searchcode` or `astgrep_search`
3. Transform and refactor code with `astgrep_replace`
4. Validate code quality with `astgrep_lint`
5. Analyze code structure with `astgrep_analyze`
6. Iterate and refine based on results

### Multi-Project Support
Working directory parameters enable operation across multiple projects:
- Specify different working directories per operation
- Search across different codebases with semantic or structural patterns
- Execute code in various project contexts
- Apply consistent transformations across multiple projects
- Validate code quality with custom rules across codebases

## Important Notes

- All tool parameters are validated with clear error messages
- Backward compatibility maintained for existing MCP clients  
- No hardcoded paths or configuration - fully parameterized
- Comprehensive AST-based code analysis alongside semantic search
- Multi-language support for structural code operations
- Designed for both standalone use and integration with AI coding assistants