#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { allTools } from './core/mcp-tools.js';
// Server configuration constants
const SERVER_CONFIG = {
  name: 'glootie-mcp',
  version: '3.2.4',
  description: 'Glootie active: Never do anything before calling mcp__glootie__begin.'
};

// Create and configure the server
const server = new Server(
  {
    name: SERVER_CONFIG.name,
    version: SERVER_CONFIG.version,
    description: SERVER_CONFIG.description
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Get all available tools
const tools = allTools;

// Register list_tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools
  };
});

// Register call_tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tool = tools.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }

  // Execute the tool
  try {
    const result = await tool.handler(args);

    // If the result is already in MCP content format, return it directly
    if (result && result.content) {
      return result;
    }

    // Otherwise, wrap it in standard format
    return {
      content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  // Suppress stderr warnings that are not critical
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function(string, encoding, fd) {
    const message = string.toString();
    // Suppress ast-grep prebuild warnings (they're harmless)
    if (!message.includes('@ast-grep/lang: no prebuild for Linux ARM64')) {
      return originalStderrWrite.call(process.stderr, string, encoding, fd);
    }
    return true;
  };

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Glootie server running on stdio');
}

// Auto-start when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`Failed to start MCP Glootie server: ${error}`);
    process.exit(1);
  });
}

// Re-export only essential parts
export * from './core/mcp-tools.js';
export { server };