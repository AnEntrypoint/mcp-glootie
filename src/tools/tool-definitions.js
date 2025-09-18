

import { executionTools } from './execution-tools.js';
import { searchTools, astTools, enhancedAstTools, batchTools, thinkingTools } from './ast-tools.js';

export function getAllTools() {
  return [
    ...thinkingTools,           // Sequential thinking for complex tasks
    ...executionTools,          // Validation before editing
    ...searchTools,             // Semantic search
    ...astTools,                // AST parsing
    ...enhancedAstTools,        // Advanced AST operations
    ...batchTools               // Batch operations
  ];
}