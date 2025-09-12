// Core MCP server implementation
// Main server setup and request handling logic

import * as path from 'node:path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js"; 
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getAllTools } from './tool-definitions.js';
import { createErrorResponse } from './common-errors.js';
import { getSequentialThinkingToolDefinition } from './thinking-handler.js';

/**
 * Initialize MCP server with lazy-loaded dependencies
 */
export async function createMCPServer(workingDir) {
  // Load dependencies synchronously to prevent ARM64 memory corruption during lazy loading
  console.log('[DEBUG] Loading dependencies synchronously...');
  
  // Load all modules upfront to avoid memory corruption during lazy loading
  const isARM64 = process.arch === 'arm64' || process.platform === 'linux' && process.arch === 'arm64';
  
  // Use ARM64-compatible vector indexer
  let vectorIndexer = await import('./arm64-vector-indexer.js');

  const [astgrepUtils, astgrepAdvanced, astgrepHandlers, astgrepHandlersAdvanced] = await Promise.all([
    import('./astgrep-utils.js'),
    import('./astgrep-advanced.js'), 
    import('./astgrep-handlers.js'),
    import('./astgrep-handlers-advanced.js')
  ]);

  const [astgrepJsonFormats, astgrepProjectConfig, astgrepAdvancedSearch, astgrepTestValidation, astgrepEnhancedHandlers] = await Promise.all([
    import('./astgrep-json-formats.js'),
    import('./astgrep-project-config.js'),
    import('./astgrep-advanced-search.js'),
    import('./astgrep-test-validation.js'),
    import('./astgrep-enhanced-handlers.js')
  ]);

  const batchHandler = await import('./batch-handler.js');
  const bashHandler = await import('./bash-handler.js');

  // Create synchronous getter functions
  const getVectorIndexer = async () => vectorIndexer;
  const getAstGrepUtils = async () => ({ 
    astgrepUtils, astgrepAdvanced, astgrepHandlers, astgrepHandlersAdvanced 
  });
  const getEnhancedAstGrepUtils = async () => ({ 
    astgrepJsonFormats, astgrepProjectConfig, astgrepAdvancedSearch, astgrepTestValidation, astgrepEnhancedHandlers 
  });
  const getBatchHandler = async () => batchHandler;
  const getBashHandler = async () => bashHandler;

  // Initialize the MCP server
  const server = new McpServer(
    { name: "direct-node-executor", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Initialize code search lazily (don't sync on startup to prevent hanging)
  // Use ARM64-compatible semantic search
  try {
    console.log('[DEBUG] Code search will initialize on first use');
    const { initialize } = await getVectorIndexer();
    await initialize();
    console.log('[DEBUG] Code search base initialization complete');
  } catch (error) {
    console.error(`[DEBUG] Code search base initialization failed: ${error.message}`);
  }

  // Create tool handlers
  const { createToolHandlers } = await import('./tool-handlers.js');
  const toolHandlers = createToolHandlers(
    workingDir, 
    getVectorIndexer, 
    getAstGrepUtils, 
    getEnhancedAstGrepUtils, 
    getBatchHandler, 
    getBashHandler
  );
  // Load tool descriptions JSON (metadata)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  let descriptions = {};
  try {
    const raw = readFileSync(path.join(__dirname, 'tool-descriptions.json'), 'utf8');
    descriptions = JSON.parse(raw).tools || {};
  } catch (err) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) console.error('[DEBUG] Failed to load tool-descriptions.json', err.message);
    descriptions = {};
  }

  // Register ListTools handler: return the static tool definitions from code only.
  // This ensures the server advertises only implemented tools (no placeholders).
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getAllTools() }));

  // Register CallTool handler to dispatch to the tool handlers map
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const startTime = Date.now();
    const toolName = request.params?.name;
    const args = request.params?.arguments || {};

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