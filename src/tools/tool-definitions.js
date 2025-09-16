

import { executionTools } from './execution-tools.js';
import { searchTools, astTools, enhancedAstTools, batchTools, thinkingTools, vectorTools } from './ast-tools.js';

export function getAllTools() {
  return [
    ...executionTools,
    ...searchTools,
    ...astTools,
    ...enhancedAstTools,
    ...batchTools,
    ...thinkingTools,
    ...vectorTools
  ];
}