import { executionTools, getProcessStatus, closeProcess } from './tools/executor-tool.js';

export const processStatusTool = {
  name: 'process_status',
  description: 'Get status of a backgrounded process',
  inputSchema: {
    type: 'object',
    properties: {
      processId: { type: 'string', description: 'Process ID returned from execute/cmd/bash' }
    },
    required: ['processId']
  },
  handler: async ({ processId }) => {
    try {
      if (!processId || typeof processId !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid processId' }],
          isError: true
        };
      }
      const status = getProcessStatus(processId);
      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
        isError: status.error ? true : false
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Status query failed: ${e.message}` }],
        isError: true
      };
    }
  }
};

export const processCloseTool = {
  name: 'process_close',
  description: 'Close and terminate a backgrounded process',
  inputSchema: {
    type: 'object',
    properties: {
      processId: { type: 'string', description: 'Process ID returned from execute/cmd/bash' }
    },
    required: ['processId']
  },
  handler: async ({ processId }) => {
    try {
      if (!processId || typeof processId !== 'string') {
        return {
          content: [{ type: 'text', text: 'Invalid processId' }],
          isError: true
        };
      }
      const result = closeProcess(processId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: result.error ? true : false
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Process close failed: ${e.message}` }],
        isError: true
      };
    }
  }
};

export const sleepTool = {
  name: 'sleep',
  description: 'Sleep for a specified number of milliseconds',
  inputSchema: {
    type: 'object',
    properties: {
      milliseconds: { type: 'number', description: 'Number of milliseconds to sleep' }
    },
    required: ['milliseconds']
  },
  handler: async ({ milliseconds }) => {
    try {
      if (typeof milliseconds !== 'number' || milliseconds < 0) {
        return {
          content: [{ type: 'text', text: 'Invalid milliseconds: must be a non-negative number' }],
          isError: true
        };
      }
      const cap = milliseconds < 295000 ? milliseconds : 295000;
      await new Promise(resolve => setTimeout(resolve, cap));
      return {
        content: [{ type: 'text', text: `Slept for ${milliseconds}ms` }],
        isError: false
      };
    } catch (e) {
      return {
        content: [{ type: 'text', text: `Sleep failed: ${e.message}` }],
        isError: true
      };
    }
  }
};

export const allTools = [...(executionTools || []), processStatusTool, processCloseTool, sleepTool];
