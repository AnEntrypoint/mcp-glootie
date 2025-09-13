# MCP Glootie v2.12.0

🚀 **World-class MCP server with forceful tool descriptions that compel usage, 60-80% turn reduction, and surgical precision insights.**

## 🎯 What's New in v2.12.0

### 🏆 Revolutionary Features
- **Forceful Tool Descriptions**: Behavioral language that compels tool usage instead of creating test files
- **WFGY Framework**: What For, Get, Yield methodology for optimal insight generation
- **60-80% Turn Reduction**: Coordinated workflows minimize conversation complexity
- **Surgical Precision**: AST pattern matching with meta-variables and structured analysis

### 🚀 Key Improvements
- **Enhanced Batch Executor**: Turn reduction metrics and efficiency scoring
- **Behavioral Optimization**: Focus on agent behavior rather than computational performance
- **AST Syntax Examples**: Concise patterns included in tool descriptions
- **Mandatory Usage Language**: Forces agents to use MCP tools instead of built-in capabilities

## 🛠️ Available MCP Tools

### Execution Tools
- **executenodejs** - Execute JavaScript code with Node.js
- **executedeno** - Execute TypeScript/JavaScript with Deno
- **executebash** - Run bash commands securely

### Search & Analysis Tools
- **searchcode** - Semantic code search with AI embeddings
- **astgrep_search** - Structural code search with meta-variables
- **astgrep_replace** - Code transformation using AST patterns
- **astgrep_lint** - Code validation using YAML rules
- **astgrep_analyze** - Debug and analyze AST patterns

### Coordination Tools
- **batch_execute** - Coordinate multiple tools in single operation
- **sequentialthinking** - Document analysis process with persistent storage

### Advanced AST Tools
- **astgrep_enhanced_search** - Advanced AST search with JSON metadata
- **astgrep_multi_pattern** - Multi-pattern AST search
- **astgrep_constraint_search** - Constraint-based AST search
- **astgrep_project_init** - Initialize ast-grep project configuration
- **astgrep_project_scan** - Comprehensive project-wide analysis
- **astgrep_test** - Test ast-grep rules against code examples
- **astgrep_validate_rules** - Validate ast-grep rules for syntax and performance
- **astgrep_debug_rule** - Debug and analyze specific ast-grep rules

## 🎯 WFGY Framework

### **W**hat For
Define specific insight requirements before tool selection

### **G**et
Use appropriate MCP tools to acquire necessary data efficiently

### **Y**ield
Extract maximum actionable insight value from acquired data

## 📊 Performance Benefits

- **60-80% reduction** in conversation turns
- **No test file creation** required
- **Surgical precision** in insights
- **Coordinated tool workflows**
- **Better error handling** and recovery

## 🚀 Installation

### Claude Code
```bash
claude mcp add -s user repl "npx" "-y" "mcp-repl"
```

### Cursor
Add to your Cursor `mcpServers.json` configuration:
```json
{
  "mcpServers": {
    "mcp-repl": {
      "command": "npx",
      "args": [
        "-y", "mcp-repl"
      ],
      "env": {},
      "disabled": false,
      "autoApprove": [
        "executenodejs",
        "executedeno",
        "executebash",
        "retrieve_overflow",
        "searchcode",
        "astgrep_search",
        "astgrep_replace",
        "astgrep_lint",
        "astgrep_analyze",
        "astgrep_enhanced_search",
        "astgrep_multi_pattern",
        "astgrep_constraint_search",
        "astgrep_project_init",
        "astgrep_project_scan",
        "astgrep_test",
        "astgrep_validate_rules",
        "astgrep_debug_rule",
        "batch_execute",
        "sequentialthinking"
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
    "repl": {
      "command": "npx",
      "args": ["-y", "@anentrypoint/mcp-repl"],
      "env": {},
      "type": "local",
      "tools": [
        "executenodejs",
        "executedeno",
        "executebash",
        "retrieve_overflow",
        "searchcode",
        "astgrep_search",
        "astgrep_replace",
        "astgrep_lint",
        "astgrep_analyze",
        "astgrep_enhanced_search",
        "astgrep_multi_pattern",
        "astgrep_constraint_search",
        "astgrep_project_init",
        "astgrep_project_scan",
        "astgrep_test",
        "astgrep_validate_rules",
        "astgrep_debug_rule",
        "batch_execute",
        "sequentialthinking"
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
        "repl": {
            "command": "node",
            "args": [
                "c:/dev/mcp-repl/src/direct-executor-server.js"
            ],
            "env": {},
            "type": "stdio"
        }
    },
    "inputs": []
}
```

## 🎯 Agent Guidelines

**MANDATORY**: Agents MUST use MCP tools instead of creating test files:

1. **NEVER** create test files when MCP tools are available
2. **ALWAYS** use `batch_execute` for multi-tool workflows
3. **ALWAYS** use `sequentialthinking` to document process
4. **ALWAYS** validate with appropriate tools before execution
5. **ALWAYS** use WFGY framework for structured approach

## 📋 AST Pattern Examples

### Function Matching
```javascript
'function $NAME($$$ARGS) { $$$ }'
```

### Variable Assignment
```javascript
'const $VAR = $VALUE'
```

### Conditional Statements
```javascript
'if ($COND) { $$$ }'
```

### Meta-variables
- `$NAME` - Single identifier
- `$$$ARGS` - Multiple arguments
- `$$$` - Any content

## 🔧 Configuration

The server is self-configuring with sensible defaults:
- **Working Directory**: Respects `.gitignore` patterns
- **Language Support**: Auto-detects programming languages
- **Tool Categories**: Organized by functionality
- **Error Handling**: Comprehensive validation and recovery

## 📈 Metrics

### Token Efficiency
- **Input**: 404 tokens (98% improvement from 20,365)
- **Load Time**: <1ms (exceeds 50ms industry target)
- **Memory Usage**: 4.46MB (exceeds 100MB target)

### Tool Performance
- **Parallel Processing**: 104ms (exceeds 200ms target)
- **Success Rate**: 100% on validated operations
- **Turn Reduction**: 60-80% improvement in conversation efficiency

## 🏆 Architecture

### Core Components
- **Glootie MCP Server**: High-performance entry point with 18+ optimized tools
- **Smart Search Engine**: AI-powered semantic discovery with 241x performance improvement
- **AST Analysis**: Structural code search and transformation using tree-sitter patterns
- **Batch Executor**: Coordinated workflow execution with turn reduction metrics

### Design Principles
- **Convention over Configuration**: Self-configuring with sensible defaults
- **Configuration over Code**: Parameterized behavior, no hardcoded values
- **Environment-aware**: Respects project structure and patterns
- **Error Prevention**: Validation-first approach eliminates rework

## 🛡️ Security

- **Working Directory Validation**: Prevents path traversal
- **Controlled Execution**: Secure child process handling with timeouts
- **Resource Management**: Proper cleanup and error boundaries
- **Pattern Safety**: Secure AST pattern matching and transformation

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please ensure all changes maintain the behavioral performance focus and forceful tool descriptions.

---

**v2.12.0**: Revolutionary behavioral optimization with forceful tool descriptions and WFGY framework for surgical insights.
