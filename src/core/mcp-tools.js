import { executionTools } from './unified-executor.js';
import { searchTools } from './unified-vector.js';
import UNIFIED_AST_TOOL from './unified-ast-tool.js';

// Create backward-compatible aliases for tools with double prefix
const createAliasTool = (originalTool, aliasName) => ({
  ...originalTool,
  name: aliasName,
  handler: originalTool.handler
});

export const allTools = [
  ...executionTools,
  ...searchTools,
  UNIFIED_AST_TOOL, // Unified AST operations with pagination
  // Add backward-compatible aliases for double prefix issue
  ...executionTools.map(tool => createAliasTool(tool, tool.name.replace('mcp__glootie__', 'mcp__glootie__mcp__glootie__'))),
  ...searchTools.map(tool => createAliasTool(tool, tool.name.replace('mcp__glootie__', 'mcp__glootie__mcp__glootie__'))),
  createAliasTool(UNIFIED_AST_TOOL, UNIFIED_AST_TOOL.name.replace('mcp__glootie__', 'mcp__glootie__mcp__glootie__'))
];