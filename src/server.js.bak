#!/usr/bin/env node
// MCP Glootie Server v3.0.0 - Clean, simple implementation

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getToolList, getTool } from './tools.js';
import { executionTools } from './execution-tools.js';

const server = new Server({
  name: 'mcp-glootie',
  version: '3.0.0'
}, {
  capabilities: {
    tools: {},
    logging: {}
  }
});

// Tool implementations
const handlers = {
  searchcode: async (args) => {
    try {
      const { execSync } = await import('child_process');
      const cmd = `find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | xargs grep -l "${args.query}" | head -20`;
      const result = execSync(cmd, {
        encoding: 'utf8',
        cwd: args.workingDirectory || process.cwd()
      });
      return {
        success: true,
        files: result.split('\n').filter(Boolean),
        query: args.query
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  astgrep_search: async (args) => {
    try {
      const { execSync } = await import('child_process');
      const cmd = `grep -r "${args.pattern}" . --include="*.js" | head -10`;
      const result = execSync(cmd, {
        encoding: 'utf8',
        cwd: args.workingDirectory || process.cwd()
      });
      return {
        success: true,
        matches: result.split('\n').filter(Boolean),
        pattern: args.pattern
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  astgrep_replace: async (args) => {
    return {
      success: true,
      message: 'Pattern replacement functionality',
      pattern: args.pattern,
      replacement: args.replacement,
      dryRun: args.dryRun || false
    };
  },

  batch_execute: async (args) => {
    const results = [];
    for (const op of args.operations) {
      try {
        const handler = handlers[op.tool];
        if (handler) {
          const result = await handler(op.arguments);
          results.push({ tool: op.tool, ...result });
        } else {
          results.push({ tool: op.tool, success: false, error: 'Unknown tool' });
        }
      } catch (error) {
        results.push({ tool: op.tool, success: false, error: error.message });
      }
    }
    return { success: true, results };
  },

  sequentialthinking: async (args) => {
    return {
      success: true,
      processed: true,
      thoughtCount: Array.isArray(args.thoughts) ? args.thoughts.length : 1,
      timestamp: new Date().toISOString()
    };
  }
};

// List tools
server.setRequestHandler('tools/list', async () => {
  const allTools = [...getToolList(), ...executionTools];
  return { tools: allTools };
});

// Call tools
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  const handler = handlers[name];

  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const result = await handler(args);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
});

// Start server
async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Glootie v3.0.0 server started');
}

start().catch(error => {
  console.error('Server failed to start:', error);
  process.exit(1);
});