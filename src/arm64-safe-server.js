#!/usr/bin/env node
// ARM64-safe MCP server using manual JSON-RPC instead of StdioServerTransport

import { createMCPServer } from './server-core.js';
import { getAllTools } from './tool-definitions.js';

console.log('[DEBUG] Starting ARM64-safe MCP server...');

// Create the server but don't use the problematic transport
const server = await createMCPServer(process.cwd());
const tools = getAllTools();

console.log('[DEBUG] Server created, setting up manual JSON-RPC handling...');

// Manual JSON-RPC message handling
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      let request;
      try {
        request = JSON.parse(line.trim());
        const response = await handleRequest(request);
        if (response) {
          console.log(JSON.stringify(response));
        }
      } catch (error) {
        // Only send error response for requests (with id), not notifications
        if (request && request.id !== undefined) {
          console.log(JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32700, message: "Parse error: " + error.message }
          }));
        } else {
          console.error('[DEBUG] Parse error for notification:', error.message);
        }
      }
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});

// Track initialization state
let isInitialized = false;

async function handleRequest(request) {
  const { method, params, id } = request;
  
  switch (method) {
    case 'initialize':
      // Proper MCP initialize response with capabilities negotiation
      const clientVersion = params?.protocolVersion || "2024-11-05";
      const supportedVersion = "2024-11-05"; // Our supported version
      
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: supportedVersion,
          capabilities: { 
            tools: {},
            logging: {}
          },
          serverInfo: { 
            name: "mcp-glootie-arm64-safe", 
            version: "2.5.1" 
          }
        }
      };
      
    case 'notifications/initialized':
      // Handle the initialized notification - no response needed
      isInitialized = true;
      console.error('[DEBUG] MCP handshake completed successfully');
      return null;
      
    case 'ping':
      // Handle ping requests (allowed even before initialization)
      return {
        jsonrpc: "2.0",
        id,
        result: {}
      };
      
    case 'tools/list':
      if (!isInitialized) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32002, message: "Server not initialized" }
        };
      }
      return {
        jsonrpc: "2.0", 
        id,
        result: { tools }
      };
      
    case 'tools/call':
      if (!isInitialized) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32002, message: "Server not initialized" }
        };
      }
      try {
        // Get tool handlers with ARM64-compatible semantic search
        const { createToolHandlers } = await import('./tool-handlers.js');
        const vectorIndexer = await import('./arm64-vector-indexer.js');
        const toolHandlers = createToolHandlers(
          process.cwd(),
          async () => vectorIndexer,
          async () => {
            const utils = await import('./astgrep-utils.js');
            const handlers = await import('./astgrep-handlers.js');
            const handlersAdvanced = await import('./astgrep-handlers-advanced.js');
            return { 
              astgrepUtils: utils, 
              astgrepHandlers: handlers, 
              astgrepHandlersAdvanced: handlersAdvanced 
            };
          },
          async () => ({}), // Mock enhanced utils
          async () => (await import('./batch-handler.js')),
          async () => (await import('./bash-handler.js'))
        );
        
        const handler = toolHandlers[params.name];
        if (!handler) {
          throw new Error(`Unknown tool: ${params.name}`);
        }
        
        const result = await handler(params.arguments || {});
        
        return {
          jsonrpc: "2.0",
          id,
          result
        };
      } catch (error) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32000, message: error.message }
        };
      }
      
    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Method not found" }
      };
  }
}

console.log('[DEBUG] ARM64-safe MCP server ready');