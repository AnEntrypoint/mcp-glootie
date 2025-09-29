import { executionTools } from '../tools/executor-tool.js';
import { searchTools } from '../tools/vector-tool.js';
import AST_TOOL from '../tools/ast-tool.js';
import { caveatTools } from '../tools/caveat-tool.js';
import { failureAnalysisTools } from '../tools/failure-analysis-tool.js';

const createAliasTool = (originalTool, aliasName) => ({
  ...originalTool,
  name: aliasName,
  handler: originalTool.handler
});

export const allTools = [
  ...executionTools,
  ...searchTools,
  AST_TOOL,
  ...caveatTools,
  ...failureAnalysisTools
];