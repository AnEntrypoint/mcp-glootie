// Tool definitions aggregator for MCP REPL server
// Imports and combines all tool definitions from specialized modules

import { executionTools } from './execution-tools.js';
import { searchTools, astTools, enhancedAstTools, batchTools, thinkingTools } from './ast-tools.js';

// Get all tools with architecture-aware feature detection
export function getAllTools() {
  const tools = [
    ...executionTools,
    ...astTools,
    ...enhancedAstTools,
    ...batchTools,
    ...thinkingTools
  ];

  // Only include semantic search tools on non-ARM64 architectures
  // ARM64 systems don't support transformers due to native module compatibility issues
  if (process.arch !== 'arm64') {
    tools.splice(1, 0, ...searchTools); // Insert searchTools after executionTools
  }

  return tools;
}