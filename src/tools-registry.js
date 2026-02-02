import { executionTools } from './tools/executor-tool-isolated.js';

const response = {
  success(text) {
    return {
      content: [{ type: 'text', text }],
      isError: false
    };
  },
  error(text) {
    return {
      content: [{ type: 'text', text }],
      isError: true
    };
  },
  json(data, isErr = false) {
    return this[isErr ? 'error' : 'success'](JSON.stringify(data, null, 2));
  }
};

const createSimpleTool = (name, description, inputSchema, handler) => ({
  name,
  description,
  inputSchema,
  handler
});

export const sleepTool = createSimpleTool(
  'sleep',
  'Sleep for a specified number of milliseconds',
  {
    type: 'object',
    properties: {
      milliseconds: { type: 'number', description: 'Number of milliseconds to sleep' }
    },
    required: ['milliseconds']
  },
  async ({ milliseconds }) => {
    try {
      if (typeof milliseconds !== 'number' || milliseconds < 0) {
        return response.error('Invalid milliseconds: must be a non-negative number');
      }
      const cap = milliseconds < 295000 ? milliseconds : 295000;
      await new Promise(resolve => setTimeout(resolve, cap));
      return response.success(`Slept for ${milliseconds}ms`);
    } catch (e) {
      return response.error(`Sleep failed: ${e.message}`);
    }
  }
);

export const allTools = [...(executionTools || []), sleepTool];
