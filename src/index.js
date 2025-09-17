#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getAllTools } from './tools/tool-definitions.js';
import { TOOL_STRINGS } from './constants/tool-strings.js';

// Create and configure the server
const server = new Server(
  {
    name: TOOL_STRINGS.SERVER_NAME,
    version: TOOL_STRINGS.SERVER_VERSION,
    description: TOOL_STRINGS.SERVER_DESCRIPTION
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Get all available tools
const tools = getAllTools();

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
    throw new Error(`${TOOL_STRINGS.UNKNOWN_TOOL} ${name}`);
  }

  // Execute the tool
  try {
    const result = await tool.handler(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `${TOOL_STRINGS.ERROR_PREFIX} ${error.message}` }],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(TOOL_STRINGS.SERVER_RUNNING_MESSAGE);
}

// Auto-start when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`${TOOL_STRINGS.SERVER_ERROR_MESSAGE} ${error}`);
    process.exit(1);
  });
}

// Re-export only essential parts
export * from './tools/index.js';
export { server };