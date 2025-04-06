# 🚀 MCP-REPL: The Universal JavaScript REPL Server

![Version](https://img.shields.io/badge/version-1.0.114-blue)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🧙‍♂️ Accelerate Your Debugging Workflow

Welcome to MCP-REPL, a powerful JavaScript execution environment that dramatically speeds up your debugging process. By enabling direct calls to the REPL via the Model Context Protocol (MCP), this tool significantly reduces the number of agent iterations needed to solve complex problems.

for cursor this would be in your .cursor/mcp.json
```
{
  "mcpServers": {
    "mcp-repl": {
      "command": "npx",
      "args": [
        "-y", "mcp-repl", "C:/your/project/path"
      ],
      "env": {},
      "disabled": false,
      "autoApprove": ["execute"]
    }
  }
}
```

## ✨ Features That Streamline Development

- 🚀 **Direct Execution**: Execute JavaScript code directly through MCP calls, eliminating back-and-forth iterations
- ⏱️ **Instant Feedback**: Get immediate results from code execution without waiting for multiple agent responses
- 🔍 **Real-time Debugging**: Quickly identify and fix issues with immediate execution feedback
- 🧠 **Smart Code Analysis**: Automatically detects code patterns to optimize execution settings
- 🔄 **Resource Tracking**: Monitors timers, promises, and network requests for comprehensive debugging
- 🌐 **Universal Compatibility**: Works seamlessly with both CLI and web applications through SSE

## 🚀 Quick Start
