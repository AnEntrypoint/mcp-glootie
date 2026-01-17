#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { executionTools, getProcessStatus, closeProcess } from './tools/executor-tool.js';

const subscriptions = new Set();

const server = new Server(
  {
    name: 'glootie',
    version: '3.4.67',
    description: 'Code execution for programming agents'
  },
  {
    capabilities: { tools: {}, resources: {} }
  }
);

const processStatusTool = {
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

const processCloseTool = {
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

const sleepTool = {
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
      await new Promise(resolve => setTimeout(resolve, milliseconds));
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

const tools = [...(executionTools || []), processStatusTool, processCloseTool, sleepTool];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    return {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }))
    };
  } catch (error) {
    console.error('[ListTools] Error:', error);
    return { tools: [] };
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request || !request.params || !request.params.name) {
      return {
        content: [{ type: 'text', text: 'Invalid request parameters' }],
        isError: true
      };
    }

    const { name, arguments: args } = request.params;
    const tool = tools.find(t => t.name === name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true
      };
    }

    try {
      const result = await tool.handler(args || {});
      return result;
    } catch (toolError) {
      return {
        content: [{ type: 'text', text: `Tool error: ${toolError?.message || String(toolError)}` }],
        isError: true
      };
    }
  } catch (error) {
    console.error('[CallTool] Error:', error);
    return {
      content: [{ type: 'text', text: `Server error: ${error?.message || 'Unknown error'}` }],
      isError: true
    };
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    const uri = request?.params?.uri;
    if (!uri || typeof uri !== 'string') {
      return { contents: [{ uri: 'unknown', mimeType: 'text/plain', text: 'Invalid URI' }] };
    }

    if (!uri.startsWith('glootie://process/')) {
      return { contents: [{ uri, mimeType: 'text/plain', text: 'Unknown resource type' }] };
    }

    try {
      const processId = uri.replace('glootie://process/', '');
      const status = getProcessStatus(processId);
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(status, null, 2)
        }]
      };
    } catch (e) {
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: `Failed to read resource: ${e?.message || String(e)}`
        }]
      };
    }
  } catch (error) {
    console.error('[ReadResource] Error:', error);
    return { contents: [{ uri: 'unknown', mimeType: 'text/plain', text: 'Resource read failed' }] };
  }
});

server.setRequestHandler(SubscribeRequestSchema, async (request) => {
  try {
    const uri = request?.params?.uri;
    if (uri && typeof uri === 'string') {
      subscriptions.add(uri);
    }
    return {};
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return {};
  }
});

server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
  try {
    const uri = request?.params?.uri;
    if (uri && typeof uri === 'string') {
      subscriptions.delete(uri);
    }
    return {};
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return {};
  }
});

process.on('uncaughtException', (error) => {
  try {
    console.error('[UNCAUGHT_EXCEPTION]', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
  } catch (e) {
    process.stderr.write(`Fatal error logging exception: ${e}\n`);
  }
});

process.on('unhandledRejection', (reason) => {
  try {
    console.error('[UNHANDLED_REJECTION]', {
      reason: String(reason),
      type: typeof reason,
      stack: reason?.stack
    });
  } catch (e) {
    process.stderr.write(`Fatal error logging rejection: ${e}\n`);
  }
});

process.on('warning', (warning) => {
  try {
    console.error('[WARNING]', warning.name, warning.message);
  } catch (e) {
    process.stderr.write(`Fatal error logging warning: ${e}\n`);
  }
});

process.on('exit', (code) => {
  try {
    console.error(`[EXIT] Process exiting with code ${code}`);
  } catch (e) {}
});

try {
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (error) {
  console.error('[STARTUP] Failed to connect:', error?.message || String(error));
  process.exit(1);
}
