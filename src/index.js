#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { allTools } from './core/mcp-tools.js';
// Server configuration constants
const SERVER_CONFIG = {
  name: 'glootie-mcp',
  version: '3.1.5',
  description: 'Mandatory: call authorize at the start of every user request before running TaskWrite'
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
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
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