import { executionTools } from './tools/executor-tool-isolated.js';
import { backgroundStore } from './background-tasks.js';

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

export const processStatusTool = createSimpleTool(
  'process_status',
  'Check status of a persisted background process',
  {
    type: 'object',
    properties: {
      task_id: { type: 'number', description: 'The task ID returned from execute' }
    },
    required: ['task_id']
  },
  async ({ task_id }) => {
    try {
      if (typeof task_id !== 'number' || task_id < 1) {
        return response.error('Invalid task_id: must be a positive number');
      }
      const task = backgroundStore.getTask(task_id);
      if (!task) {
        return response.error(`Task ${task_id} not found`);
      }
      return response.json({
        id: task.id,
        status: task.status,
        createdAt: new Date(task.createdAt).toISOString(),
        startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
        completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
        runtime: task.runtime,
        result: task.result
      });
    } catch (e) {
      return response.error(`Status check failed: ${e.message}`);
    }
  }
);

export const processCloseTool = createSimpleTool(
  'process_close',
  'Clean up a completed background process',
  {
    type: 'object',
    properties: {
      task_id: { type: 'number', description: 'The task ID to close' }
    },
    required: ['task_id']
  },
  async ({ task_id }) => {
    try {
      if (typeof task_id !== 'number' || task_id < 1) {
        return response.error('Invalid task_id: must be a positive number');
      }
      const task = backgroundStore.getTask(task_id);
      if (!task) {
        return response.error(`Task ${task_id} not found`);
      }
      backgroundStore.deleteTask(task_id);
      return response.success(`Task ${task_id} closed`);
    } catch (e) {
      return response.error(`Close failed: ${e.message}`);
    }
  }
);

export const allTools = [...(executionTools || []), sleepTool, processStatusTool, processCloseTool];
