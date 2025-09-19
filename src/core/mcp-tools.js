import { executionTools } from './unified-executor.js';
import { overflowTools } from './overflow-handler.js';
import { searchTools } from './unified-vector.js';
import { astTools, advancedAstTools } from './ast-tools.js';
import { batchTools } from './utilities.js';
import { beginTools } from './authorization.js';
import { projectUnderstandTool, projectUnderstandHandler } from './project-understand.js';

const projectUnderstandWithHandler = {
  ...projectUnderstandTool,
  handler: projectUnderstandHandler
};

export const allTools = [
  ...executionTools,
  ...overflowTools,
  ...searchTools,
  ...astTools,
  ...advancedAstTools,
  ...batchTools,
  ...beginTools,
  projectUnderstandWithHandler
];