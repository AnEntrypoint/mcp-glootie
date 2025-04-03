#!/usr/bin/env node
// Universal REPL server using MCP SDK v2.0

import * as path from 'node:path';
import * as util from 'node:util';
import * as fs from 'node:fs'; // Ensure fs is imported
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js"; 
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { debugLog, formatError } from './src/utils.js';
import { listToolsHandler, callToolHandler } from './src/mcp-handlers.js';

// Debug mode flag
const DEBUG = process.argv.includes('--debug');

// Determine the default working directory from argv[2] or fallback to cwd
const defaultWorkingDirectory = process.argv[2] 
    ? path.resolve(process.argv[2]) 
    : process.cwd();
debugLog(`Default working directory determined: ${defaultWorkingDirectory}`);

// Initialize MCP server with tool capabilities
const server = new McpServer(
  {
    name: "universal-repl-server", 
    version: "2.1.0", // Updated version for robust approach
  },
  {
    capabilities: {
      tools: {}, // Explicitly enable tool support
    },
  },
);

// Add debug logger for SDK communication if DEBUG is enabled
if (DEBUG) {
  try {
      if (typeof server.on === 'function') {
          server.on('request', (req) => {
              debugLog(`MCP SDK received request: ${JSON.stringify(req)}`);
          });
          server.on('response', (res) => {
              debugLog(`MCP SDK sending response: ${JSON.stringify(res)}`);
          });
      } else {
         debugLog('Warning: server.on method not available for SDK event listeners');
      }
  } catch (e) {
     debugLog(`Warning: Could not attach SDK event listeners: ${e.message}`);
  }
}

// --- Register MCP Handlers from Module ---
server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);

server.setRequestHandler(CallToolRequestSchema, (request) => {
    // Pass the determined defaultWorkingDirectory to the handler
    return callToolHandler(request, defaultWorkingDirectory); 
});
// --- End Register MCP Handlers ---

// --- Global Error Handlers --- 
process.on('uncaughtException', (err, origin) => {
  const errorMsg = `UNCAUGHT EXCEPTION: ${formatError(err)}\nOrigin: ${origin}`;
  process.stderr.write(`${errorMsg}\n`);
  debugLog(errorMsg); 
  // Keep server alive if possible
});

process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = `UNHANDLED REJECTION: ${reason instanceof Error ? formatError(reason) : String(reason)}`;
  process.stderr.write(`${errorMsg}\n`);
  debugLog(errorMsg);
});
// --- End Global Error Handlers ---

// Main function to start the server
async function main() {
  try {
    // Log important context information
    debugLog(`Server starting...`);
    debugLog(`Node version: ${process.version}`);
    debugLog(`Default working directory: ${defaultWorkingDirectory}`);
    debugLog(`Full command-line args: ${JSON.stringify(process.argv)}`);
    
    process.stderr.write('Universal REPL server started. Waiting for MCP requests...\n');
    
    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect the server to the transport
    await server.connect(transport);
    debugLog('Successfully connected to MCP transport');
    
    // Listen for SIGINT to gracefully shutdown
    process.on('SIGINT', () => {
      process.stderr.write('\nREPL server shutting down...\n');
      server.dispose(); // Cleanly dispose server resources
      process.exit(0);
    });

  } catch (error) {
    const errorMsg = `Error starting REPL server: ${formatError(error)}`;
    process.stderr.write(`${errorMsg}\n`);
    debugLog(errorMsg); // Log the startup error
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  // Catch errors from the async main function itself
  const errorMsg = `Unhandled error during server startup: ${formatError(error)}`;
  process.stderr.write(`${errorMsg}\n`);
  debugLog(errorMsg);
  process.exit(1);
});
