import { executionTools, getProcessStatus, closeProcess } from './tools/executor-tool.js';

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

export const processStatusTool = createSimpleTool(
  'process_status',
  'Get status of a backgrounded process',
  {
    type: 'object',
    properties: {
      processId: { type: 'string', description: 'Process ID returned from execute/cmd/bash' }
    },
    required: ['processId']
  },
  async ({ processId }) => {
    try {
      if (!processId || typeof processId !== 'string') {
        return response.error('Invalid processId');
      }
      const status = getProcessStatus(processId);
      return response.json(status, status.error ? true : false);
    } catch (e) {
      return response.error(`Status query failed: ${e.message}`);
    }
  }
);

export const processCloseTool = createSimpleTool(
  'process_close',
  'Close and terminate a backgrounded process',
  {
    type: 'object',
    properties: {
      processId: { type: 'string', description: 'Process ID returned from execute/cmd/bash' }
    },
    required: ['processId']
  },
  async ({ processId }) => {
    try {
      if (!processId || typeof processId !== 'string') {
        return response.error('Invalid processId');
      }
      const result = closeProcess(processId);
      return response.json(result, result.error ? true : false);
    } catch (e) {
      return response.error(`Process close failed: ${e.message}`);
    }
  }
);

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

export const allTools = [...(executionTools || []), processStatusTool, processCloseTool, sleepTool];
