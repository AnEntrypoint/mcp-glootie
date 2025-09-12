// Tool definitions aggregator for MCP REPL server
// Imports and combines all tool definitions from specialized modules

import { executionTools } from './execution-tools.js';
import { searchTools, astTools, enhancedAstTools, batchTools, thinkingTools } from './ast-tools.js';

// Get all tools - semantic search now works on all architectures
export function getAllTools() {
  return [
    ...executionTools,
    ...searchTools, // Always include - ARM64-compatible now
    ...astTools,
    ...enhancedAstTools,
    ...batchTools,
    ...thinkingTools
  ];
}