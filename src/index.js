#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js';

(async () => {
  const isRemoteUrl = import.meta.url.includes('raw.githubusercontent.com');
  const baseUrl = isRemoteUrl
    ? 'https://raw.githubusercontent.com/AnEntrypoint/mcp-glootie/main/src/'
    : new URL('./', import.meta.url).pathname;

  const { allTools } = await import(baseUrl + 'tools-registry.js');
  const { recoveryState } = await import(baseUrl + 'recovery-state.js');
  const { globalPool } = await import(baseUrl + 'workers/worker-pool.js');
  const { backgroundStore } = await import(baseUrl + 'background-tasks.js');

  const subscriptions = new Set();

  const server = new Server(
    { name: 'glootie', version: '3.4.72', description: 'Code execution for programming agents' },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return { tools: allTools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
    } catch (error) {
      console.error('[ListTools] Error:', error);
      return { tools: [] };
    }
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      if (!request?.params?.name) {
        return { content: [{ type: 'text', text: 'Invalid request parameters' }], isError: true };
      }
      const { name, arguments: args } = request.params;
      const tool = allTools.find(t => t.name === name);
      if (!tool) {
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }
      try {
        return await tool.handler(args || {});
      } catch (toolError) {
        return { content: [{ type: 'text', text: `Tool error: ${toolError?.message || String(toolError)}` }], isError: true };
      }
    } catch (error) {
      console.error('[CallTool] Error:', error);
      return { content: [{ type: 'text', text: `Server error: ${error?.message || 'Unknown error'}` }], isError: true };
    }
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const uri = request?.params?.uri;
      if (!uri || typeof uri !== 'string') {
        return { contents: [{ uri: 'unknown', mimeType: 'text/plain', text: 'Invalid URI' }] };
      }
      if (uri.startsWith('task://')) {
        const taskId = parseInt(uri.slice(7), 10);
        const task = backgroundStore.getTask(taskId);
        if (!task) {
          return { contents: [{ uri, mimeType: 'text/plain', text: 'Task not found' }] };
        }
        const result = task.result || {};
        let text = '';
        if (result.error) {
          text = `Error: ${result.error}`;
        } else {
          if (result.stdout) text += `[STDOUT]\n${result.stdout}`;
          if (result.stderr) text += text ? `\n\n[STDERR]\n${result.stderr}` : `[STDERR]\n${result.stderr}`;
          if (!text) text = '(no output)';
        }
        backgroundStore.deleteTask(taskId);
        return { contents: [{ uri, mimeType: 'text/plain', text }] };
      }
      return { contents: [{ uri, mimeType: 'text/plain', text: 'Unknown resource type' }] };
    } catch (error) {
      console.error('[ReadResource] Error:', error);
      return { contents: [{ uri: 'unknown', mimeType: 'text/plain', text: 'Resource read failed' }] };
    }
  });

  server.setRequestHandler(SubscribeRequestSchema, async (request) => {
    try {
      const uri = request?.params?.uri;
      if (uri && typeof uri === 'string') subscriptions.add(uri);
      return {};
    } catch (error) {
      console.error('[Subscribe] Error:', error);
      return {};
    }
  });

  server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
    try {
      const uri = request?.params?.uri;
      if (uri && typeof uri === 'string') subscriptions.delete(uri);
      return {};
    } catch (error) {
      console.error('[Unsubscribe] Error:', error);
      return {};
    }
  });

  process.on('uncaughtException', (error) => {
    try {
      console.error('[UNCAUGHT_EXCEPTION]', { name: error?.name, message: error?.message, stack: error?.stack });
    } catch (e) {
      process.stderr.write(`Fatal error logging exception: ${e}\n`);
    }
  });

  process.on('unhandledRejection', (reason) => {
    try {
      console.error('[UNHANDLED_REJECTION]', { reason: String(reason), type: typeof reason, stack: reason?.stack });
    } catch (e) {
      process.stderr.write(`Fatal error logging rejection: ${e}\n`);
    }
  });

  process.on('warning', (warning) => {
    try { console.error('[WARNING]', warning.name, warning.message); } catch (e) {}
  });

  process.on('exit', (code) => {
    try { console.error(`[EXIT] Process exiting with code ${code}`); } catch (e) {}
  });

  let shuttingDown = false;
  let backoffTimer = null;

  async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      console.error(`[${signal}] Shutting down gracefully`);
      if (backoffTimer) { clearTimeout(backoffTimer); backoffTimer = null; }
      backgroundStore.shutdown();
      subscriptions.clear();
      await globalPool.shutdown();
      process.exit(0);
    } catch (e) {
      try { await globalPool.shutdown(); } catch (_) {}
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  async function startupWithRecovery() {
    while (recoveryState.canRetry()) {
      try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        recoveryState.recordSuccess();
        console.error('[STARTUP] Connected successfully');
        return;
      } catch (error) {
        recoveryState.recordStartupAttempt(error);
        const delay = recoveryState.getBackoffDelay();
        console.error(`[STARTUP] Attempt ${recoveryState.startupAttempts} failed: ${error?.message || String(error)}. Retrying in ${delay}ms...`);
        await new Promise(resolve => { backoffTimer = setTimeout(resolve, delay); });
        backoffTimer = null;
      }
    }
    console.error(`[STARTUP] Failed after ${recoveryState.maxStartupAttempts} attempts. Last error: ${recoveryState.lastError}`);
  }

  startupWithRecovery().catch(error => {
    console.error('[STARTUP] Unhandled error during recovery:', error);
  });
})();
