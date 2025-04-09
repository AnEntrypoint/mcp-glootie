# 🚀 Direct Node.js REPL Executor

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🧙‍♂️ Simplified JavaScript Execution Environment

A streamlined direct Node.js execution environment that enables seamless code execution with full support for:

- **ESM Modules** - Native import/export syntax
- **Dynamic Imports** - Full support for await import() 
- **CommonJS compatibility** - Works with require() through createRequire
- **Native Node.js API access** - Direct access to all Node.js features

## 🧩 Configuration

For Cursor, update your `.cursor/mcp.json` configuration:

```json
{
  "mcpServers": {
    "mcp-repl": {
      "command": "node",
      "args": [
        "path/to/direct-node-executor.js", "path/to/your/project"
      ],
      "env": {},
      "disabled": false,
      "autoApprove": ["execute"]
    }
  }
}
```

## ✨ Features

- 🚀 **Direct Node.js Execution**: Runs code directly in Node.js without VM sandboxing
- 📦 **Full Module Support**: Seamless support for ESM and CommonJS modules
- ⏱️ **Real-time Feedback**: Get immediate results from code execution
- 🔍 **Enhanced Debugging**: Clean output with proper error handling
- 🧠 **Simple Architecture**: Streamlined implementation with minimal complexity
- 🔄 **File System Access**: Full access to the file system for real testing

## 🛠️ Implementation Details

This implementation:

1. Creates temporary `.mjs` files for each execution
2. Runs the code directly with Node.js in a separate process
3. Captures all console output and execution results
4. Cleans up temporary files automatically
5. Returns standardized results to the MCP client

## 📝 Usage Examples

```javascript
// Dynamic imports
const fs = await import('fs/promises');
const path = await import('path');

// Reading files
const content = await fs.readFile('package.json', 'utf8');
console.log(JSON.parse(content));

// Using path utilities
console.log(path.join('folder', 'file.txt'));
```

