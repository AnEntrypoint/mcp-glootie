import { executionTools } from '../tools/executor-tool.js';
import { searchTools } from '../tools/vector-tool.js';
import AST_TOOL from '../tools/ast-tool.js';
import {
  ASYNC_SEARCH_TOOL,
  JOB_STATUS_TOOL,
  JOB_RESULTS_TOOL,
  JOB_LIST_TOOL,
  JOB_CANCEL_TOOL
} from '../tools/vector-search-async.js';

const createAliasTool = (originalTool, aliasName) => ({
  ...originalTool,
  name: aliasName,
  handler: originalTool.handler
});

export const allTools = [
  ...executionTools,
  ...searchTools,
  AST_TOOL,
  ASYNC_SEARCH_TOOL,
  JOB_STATUS_TOOL,
  JOB_RESULTS_TOOL,
  JOB_LIST_TOOL,
  JOB_CANCEL_TOOL
];