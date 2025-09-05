// Core MCP server implementation
// Main server setup and request handling logic

import * as path from 'node:path';
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js"; 
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getAllTools } from './tool-definitions.js';
import { createToolHandlers } from './tool-handlers.js';
import { createErrorResponse } from './common-errors.js';

/**
 * Initialize MCP server with lazy-loaded dependencies
 */
export async function createMCPServer(workingDir) {
  // Lazy load dependencies to avoid startup issues
  let vectorIndexer = null;
  let astgrepUtils = null;
  let astgrepEnhanced = null;
  let batchHandler = null;
  let bashHandler = null;

  const getVectorIndexer = async () => {
    if (!vectorIndexer) {
      vectorIndexer = await import('./js-vector-indexer.js');
    }
    return vectorIndexer;
  };

  const getAstGrepUtils = async () => {
    if (!astgrepUtils) {
      const [utils, advanced, handlers, handlersAdvanced] = await Promise.all([
        import('./astgrep-utils.js'),
        import('./astgrep-advanced.js'),
        import('./astgrep-handlers.js'),
        import('./astgrep-handlers-advanced.js')
      ]);
      astgrepUtils = { astgrepUtils: utils, astgrepAdvanced: advanced, astgrepHandlers: handlers, astgrepHandlersAdvanced: handlersAdvanced };
    }
    return astgrepUtils;
  };

  const getEnhancedAstGrepUtils = async () => {
    if (!astgrepEnhanced) {
      const [jsonFormats, projectConfig, advancedSearch, testValidation, enhancedHandlers] = await Promise.all([
        import('./astgrep-json-formats.js'),
        import('./astgrep-project-config.js'),
        import('./astgrep-advanced-search.js'),
        import('./astgrep-test-validation.js'),
        import('./astgrep-enhanced-handlers.js')
      ]);
      astgrepEnhanced = { astgrepJsonFormats: jsonFormats, astgrepProjectConfig: projectConfig, astgrepAdvancedSearch: advancedSearch, astgrepTestValidation: testValidation, astgrepEnhancedHandlers: enhancedHandlers };
    }
    return astgrepEnhanced;
  };

  const getBatchHandler = async () => {
    if (!batchHandler) {
      batchHandler = await import('./batch-handler.js');
    }
    return batchHandler;
  };

  const getBashHandler = async () => {
    if (!bashHandler) {
      bashHandler = await import('./bash-handler.js');
    }
    return bashHandler;
  };

  // Initialize the MCP server
  const server = new McpServer(
    { name: "direct-node-executor", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Initialize code search on startup
  try {
    const { initialize, syncIndex } = await getVectorIndexer();
    await initialize();
    await syncIndex([workingDir]);
  } catch (error) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.error(`[DEBUG] Code search initialization failed: ${error.message}`);
    }
  }

  // Create tool handlers
  const toolHandlers = createToolHandlers(
    workingDir, 
    getVectorIndexer, 
    getAstGrepUtils, 
    getEnhancedAstGrepUtils, 
    getBatchHandler, 
    getBashHandler
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getAllTools() }));

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const startTime = Date.now();
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    const handler = toolHandlers[toolName];
    if (!handler) {
      return createErrorResponse(`Unknown tool: ${toolName}`, startTime);
    }

    try {
      return await handler(args);
    } catch (error) {
      return createErrorResponse(error, startTime, { tool: toolName });
    }
  });

  return server;
}

/**
 * Start the MCP server
 */
export async function startServer() {
  const workingDir = process.argv[2] && !process.argv[2].startsWith('-')
    ? path.resolve(process.argv[2]) 
    : process.cwd();

  const server = await createMCPServer(workingDir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}