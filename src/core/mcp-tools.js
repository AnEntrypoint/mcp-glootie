import { executionTools } from './unified-executor.js';
import { overflowTools } from './overflow-handler.js';
import { searchTools } from './unified-vector.js';
import { astTools, advancedAstTools } from './ast-tools.js';
import { batchTools } from './utilities.js';
import { thinkingTools } from './thinking-handler.js';

export const allTools = [
  ...executionTools,
  ...overflowTools,
  ...searchTools,
  ...astTools,
  ...advancedAstTools,
  ...batchTools,
  ...thinkingTools
];