import { executionTools } from './unified-executor.js';
import { searchTools } from './unified-vector.js';
import { beginTools } from './begin.js';
import UNIFIED_AST_TOOL from './unified-ast-tool.js';

export const allTools = [
  ...executionTools,
  ...searchTools,
  UNIFIED_AST_TOOL, // Unified AST operations with pagination
  ...beginTools
];