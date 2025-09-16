// Only include working utility files
export * from './batch-utils.js';
export * from './vector-indexer-utils.js';

import { getAllTools } from '../tools/tool-definitions.js';

export const tools = getAllTools();

export function getTool(name) {
  return tools.find(tool => tool.name === name);
}

export function hasTool(name) {
  return tools.some(tool => tool.name === name);
}

export const toolNames = tools.map(tool => tool.name);

export default tools;