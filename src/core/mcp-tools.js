import { executionTools } from '../tools/executor-tool.js';
import AST_TOOL from '../tools/ast-tool.js';
import { caveatTools } from '../tools/caveat-tool.js';

const createAliasTool = (originalTool, aliasName) => ({
  ...originalTool,
  name: aliasName,
  handler: originalTool.handler
});

export const allTools = [
  ...executionTools,
  AST_TOOL,
  ...caveatTools
];