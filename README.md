# 🚀 MCP-REPL: The Universal JavaScript REPL Server

![Version](https://img.shields.io/badge/version-1.0.114-blue)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 🧙‍♂️ The Magical Code Playground

Welcome to MCP-REPL, where JavaScript code comes to life in a secure sandbox! This isn't just any REPL server - it's a magical code playground that lets you execute JavaScript with the power of the Model Context Protocol (MCP).

## ✨ Features That Make You Go "Wow!"

- 🔒 **Super Secure Sandbox**: Run JavaScript code without fear! Our VM-based sandbox keeps the bad stuff contained.
- 🌐 **Universal Compatibility**: Works with both CLI and web applications through SSE (Server-Sent Events).
- ⚡ **Lightning Fast**: Optimized execution for all your JavaScript needs.
- 🧠 **Smart Code Analysis**: Automatically detects code patterns to optimize execution settings.
- 🔄 **Resource Tracking**: Keeps tabs on timers, promises, and network requests so nothing gets out of hand.
- 🛠️ **MCP Integration**: Seamlessly works with the Model Context Protocol for AI-powered coding assistance.

## 🚀 Quick Start

```bash
# Install it
npm install mcp-repl

# Start the CLI server
npm start

# Or start the SSE server for web applications
node universal-repl-server.js . sse
```

## 🎮 How to Use

### Basic JavaScript Execution

```javascript
// This will be evaluated and the result returned
2 + 2

// More complex examples work too!
const greeting = "Hello, World!";
console.log(greeting);
greeting.toUpperCase();
```

### Async Code? No Problem!

```javascript
// Async code works like a charm
async function fetchData() {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
  return await response.json();
}

await fetchData();
```

## 🧪 Testing

We take testing seriously (but have fun doing it)! Run our comprehensive test suite:

```bash
npm test
```

Our tests cover everything from basic arithmetic to complex async operations and error handling. We've got over 30 test files to make sure everything works perfectly!

## 🔧 Under the Hood

MCP-REPL is powered by:

- **Node.js VM Module**: For secure code execution
- **MCP SDK**: For seamless integration with AI assistants
- **Express**: For the SSE server implementation
- **Acorn**: For JavaScript parsing and analysis

## 🤝 Contributing

Found a bug? Want to add a feature? We'd love your help! Just:

1. Fork the repo
2. Create your feature branch (`git checkout -b amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- The amazing Model Context Protocol team
- All the JavaScript wizards who inspired this project
- Coffee ☕ (lots of it)

---

Made with ❤️ by the MCP Team
