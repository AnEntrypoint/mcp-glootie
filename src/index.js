#!/usr/bin/env bun
import http from 'http';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const pm2lib = require('pm2');

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes('--mcp')) {
  // --- MCP server mode ---
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { CallToolRequestSchema, ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

  const isRemoteUrl = import.meta.url.includes('raw.githubusercontent.com');
  const baseUrl = isRemoteUrl
    ? 'https://raw.githubusercontent.com/AnEntrypoint/gm-exec/main/src/'
    : new URL('./', import.meta.url).pathname;

  const { allTools } = await import(baseUrl + 'tools-registry.js');
  const { recoveryState } = await import(baseUrl + 'recovery-state.js');
  const { startRunner, stopRunner } = await import(baseUrl + 'runner-supervisor.js');

  const server = new Server(
    { name: 'gm-exec', version: '3.4.100', description: 'Code execution for programming agents' },
    { capabilities: { tools: {} } }
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
      const { name, arguments: toolArgs } = request.params;
      const tool = allTools.find(t => t.name === name);
      if (!tool) {
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      }
      try {
        return await tool.handler(toolArgs || {});
      } catch (toolError) {
        return { content: [{ type: 'text', text: `Tool error: ${toolError?.message || String(toolError)}` }], isError: true };
      }
    } catch (error) {
      console.error('[CallTool] Error:', error);
      return { content: [{ type: 'text', text: `Server error: ${error?.message || 'Unknown error'}` }], isError: true };
    }
  });

  process.on('uncaughtException', (error) => {
    try { console.error('[UNCAUGHT_EXCEPTION]', { name: error?.name, message: error?.message, stack: error?.stack }); }
    catch (e) { process.stderr.write(`Fatal error logging exception: ${e}\n`); }
  });
  process.on('unhandledRejection', (reason) => {
    try { console.error('[UNHANDLED_REJECTION]', { reason: String(reason), type: typeof reason, stack: reason?.stack }); }
    catch (e) { process.stderr.write(`Fatal error logging rejection: ${e}\n`); }
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
      await stopRunner();
      process.exit(0);
    } catch (e) {
      try { await stopRunner(); } catch (_) {}
      process.exit(1);
    }
  }
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

  async function startupWithRecovery() {
    await startRunner();
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
        await new Promise(r => { backoffTimer = setTimeout(r, delay); });
        backoffTimer = null;
      }
    }
    console.error(`[STARTUP] Failed after ${recoveryState.maxStartupAttempts} attempts. Last error: ${recoveryState.lastError}`);
  }

  startupWithRecovery().catch(error => {
    console.error('[STARTUP] Unhandled error during recovery:', error);
  });

} else {
  // --- CLI mode ---
  const RUNNER_SCRIPT = resolve(__dirname, 'task-runner.js');
  const PORT_FILE = '/tmp/glootie-runner.port';
  const PM2_NAME = 'gm-exec-runner';
  const HARD_CEILING_MS = 15000;

  function pm2connect() {
    return new Promise((res, rej) => pm2lib.connect(err => err ? rej(err) : res()));
  }
  function pm2disconnect() {
    return new Promise(res => pm2lib.disconnect(res));
  }
  function pm2start(opts) {
    return new Promise((res, rej) => pm2lib.start(opts, (err, apps) => err ? rej(err) : res(apps)));
  }
  function pm2delete(name) {
    return new Promise((res, rej) => pm2lib.delete(name, (err) => err ? rej(err) : res()));
  }
  function pm2list() {
    return new Promise((res, rej) => pm2lib.list((err, list) => err ? rej(err) : res(list)));
  }
  function pm2describe(name) {
    return new Promise((res, rej) => pm2lib.describe(name, (err, list) => err ? rej(err) : res(list)));
  }

  async function withPm2(fn) {
    await pm2connect();
    try { return await fn(); }
    finally { await pm2disconnect(); }
  }

  async function printRunningTools() {
    try {
      await pm2connect();
      const list = await pm2list();
      await pm2disconnect();
      const online = list.filter(p => p.pm2_env?.status === 'online');
      if (online.length === 0) {
        process.stderr.write('\n[Running tools: none]\n');
      } else {
        process.stderr.write('\n[Running tools]\n');
        for (const p of online) {
          const uptime = Math.floor((Date.now() - (p.pm2_env.pm_uptime || Date.now())) / 1000);
          process.stderr.write(`  ${p.name}  pid=${p.pid}  uptime=${uptime}s\n`);
        }
      }
    } catch { /* pm2 not available */ }
  }

  async function healthCheck() {
    if (!existsSync(PORT_FILE)) return false;
    try {
      const port = parseInt(readFileSync(PORT_FILE, 'utf8').trim(), 10);
      return await new Promise(res => {
        const req = http.request(
          { hostname: '127.0.0.1', port, path: '/health', method: 'GET' },
          r => res(r.statusCode === 200)
        );
        req.setTimeout(2000, () => { req.destroy(); res(false); });
        req.on('error', () => res(false));
        req.end();
      });
    } catch { return false; }
  }

  async function ensureRunner() {
    if (await healthCheck()) return false;
    process.stderr.write('Auto-starting runner...\n');
    await withPm2(async () => {
      await pm2delete(PM2_NAME).catch(() => {});
      await pm2start({ script: 'bun', args: RUNNER_SCRIPT, name: PM2_NAME, autorestart: false, watch: false });
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await healthCheck()) return true;
    }
    process.stderr.write('Runner did not become healthy in time\n');
    process.exit(1);
  }

  async function stopRunner() {
    await withPm2(() => pm2delete(PM2_NAME).catch(() => {}));
  }

  function rpcCall(method, params, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const port = parseInt(readFileSync(PORT_FILE, 'utf8').trim(), 10);
      const body = JSON.stringify({ method, params });
      const req = http.request(
        {
          hostname: '127.0.0.1', port, path: '/rpc', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        },
        res => {
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            try {
              const p = JSON.parse(data);
              if (p.error) return reject(new Error(typeof p.error === 'object' ? p.error.message : p.error));
              resolve(p.result);
            } catch { reject(new Error(`invalid response: ${data}`)); }
          });
        }
      );
      const t = setTimeout(() => { req.destroy(); reject(new Error('request timed out')); }, timeoutMs);
      req.on('error', e => { clearTimeout(t); reject(e); });
      req.on('close', () => clearTimeout(t));
      req.write(body);
      req.end();
    });
  }

  async function runCode(code, runtime, workingDirectory) {
    const autoStarted = await ensureRunner();
    const taskId = await rpcCall('createTask', { code, runtime, workingDirectory }).then(r => r?.taskId ?? r);

    const safetyTimeout = new Promise(r => {
      setTimeout(async () => {
        await rpcCall('startTask', { taskId }).catch(() => {});
        r({ persisted: true, backgroundTaskId: taskId });
      }, HARD_CEILING_MS);
    });

    const result = await Promise.race([
      rpcCall('execute', { code, runtime, workingDirectory, timeout: HARD_CEILING_MS, backgroundTaskId: taskId }, HARD_CEILING_MS + 5000).then(r => r?.result ?? r),
      safetyTimeout,
    ]);

    if (result.persisted || (result.backgroundTaskId && !result.completed)) {
      const id = `task_${result.backgroundTaskId ?? taskId}`;
      console.log(`Backgrounded after 15s — task still running.`);
      console.log(`Task ID: ${id}`);
      console.log(``);
      console.log(`Watch output:`);
      console.log(`  gm-exec status ${id}       # drain buffered output + status`);
      console.log(`  gm-exec close ${id}        # clean up when done`);
      console.log(`  gm-exec runner stop        # stop the runner when finished`);
      await printRunningTools();
      process.exit(0);
    }

    if (result.backgroundTaskId && result.completed) {
      await rpcCall('deleteTask', { taskId: result.backgroundTaskId }).catch(() => {});
    } else {
      await rpcCall('deleteTask', { taskId }).catch(() => {});
    }

    if (autoStarted) await stopRunner();

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) {
      process.stderr.write(`Error: ${result.error}\n`);
      await printRunningTools();
      process.exit(1);
    }

    const exitCode = result.exitCode ?? result.code ?? 0;
    await printRunningTools();
    process.exit(result.success === false ? (exitCode || 1) : 0);
  }

  async function cmdRunnerStart() {
    if (await healthCheck()) {
      console.log(`Runner already healthy on port ${readFileSync(PORT_FILE, 'utf8').trim()}`);
      return;
    }
    await withPm2(async () => {
      await pm2delete(PM2_NAME).catch(() => {});
      await pm2start({ script: 'bun', args: RUNNER_SCRIPT, name: PM2_NAME, autorestart: false, watch: false });
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await healthCheck()) {
        console.log(`Runner started on port ${readFileSync(PORT_FILE, 'utf8').trim()}`);
        return;
      }
    }
    process.stderr.write('Runner did not become healthy\n');
    process.exit(1);
  }

  async function cmdRunnerStop() {
    await stopRunner();
    console.log('Runner stopped');
  }

  async function cmdRunnerStatus() {
    const desc = await withPm2(() => pm2describe(PM2_NAME).catch(() => []));
    if (!desc || desc.length === 0) { console.log(`${PM2_NAME}: not found`); return; }
    const p = desc[0];
    const env = p.pm2_env || {};
    const uptime = env.pm_uptime ? Math.floor((Date.now() - env.pm_uptime) / 1000) + 's' : 'n/a';
    console.log(`name:     ${p.name}`);
    console.log(`status:   ${env.status}`);
    console.log(`pid:      ${p.pid}`);
    console.log(`uptime:   ${uptime}`);
    console.log(`restarts: ${env.restart_time ?? 0}`);
    if (existsSync(PORT_FILE)) console.log(`port:     ${readFileSync(PORT_FILE, 'utf8').trim()}`);
  }

  async function cmdExec(cmdArgs, positional) {
    let code = positional.join(' ');
    if (cmdArgs.file) code = readFileSync(resolve(cmdArgs.file), 'utf8');
    if (!code.trim()) { process.stderr.write('No code provided\n'); usage(); process.exit(1); }
    const cwd = resolve(cmdArgs.cwd || process.cwd());
    let runtime = cmdArgs.lang || 'nodejs';
    if (runtime === 'typescript' || runtime === 'auto') runtime = 'nodejs';
    await runCode(code, runtime, cwd);
  }

  async function cmdBash(cmdArgs, positional) {
    const commands = positional.join(' ');
    if (!commands.trim()) { process.stderr.write('No commands provided\n'); usage(); process.exit(1); }
    await runCode(commands, 'bash', resolve(cmdArgs.cwd || process.cwd()));
  }

  async function cmdStatus(taskId) {
    const autoStarted = await ensureRunner();
    const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
    const task = await rpcCall('getTask', { taskId: rawId }).then(r => r?.task ?? r);
    if (!task) { console.log('Task not found'); if (autoStarted) await stopRunner(); process.exit(1); }
    console.log(`Status: ${task.status}`);
    if (task.result) {
      const r = task.result;
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
      if (r.error) process.stderr.write(`Error: ${r.error}\n`);
    }
    const output = await rpcCall('getAndClearOutput', { taskId: rawId }).then(r => r?.output ?? r);
    if (Array.isArray(output) && output.length) {
      for (const entry of output) {
        if (entry.type === 'stdout') process.stdout.write(entry.data);
        else process.stderr.write(entry.data);
      }
    }
    if (autoStarted) await stopRunner();
  }

  async function cmdClose(taskId) {
    await ensureRunner();
    const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
    await rpcCall('deleteTask', { taskId: rawId });
    console.log(`Task ${taskId} closed`);
    const res = await rpcCall('listTasks', {}).catch(() => ({ tasks: [] }));
    const tasks = res?.tasks ?? [];
    const remaining = tasks.filter(t => t.status === 'running' || t.status === 'pending');
    if (remaining.length === 0) await stopRunner();
  }

  function parseArgs(argv) {
    const parsed = {};
    const positional = [];
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a.startsWith('--')) {
        const eq = a.indexOf('=');
        if (eq !== -1) {
          parsed[a.slice(2, eq)] = a.slice(eq + 1);
        } else {
          const key = a.slice(2);
          const next = argv[i + 1];
          if (next && !next.startsWith('--')) { parsed[key] = next; i++; }
          else parsed[key] = true;
        }
      } else {
        positional.push(a);
      }
    }
    return { args: parsed, positional };
  }

  function usage() {
    console.log(`gm-exec — code execution for MCP clients and CLI

Usage:
  gm-exec --mcp                        Start MCP server (stdio)
  gm-exec <command> [options]          CLI mode

Commands:
  exec [--lang=<lang>] [--cwd=<dir>] [--file=<path>] <code>
                                        Execute code (waits up to 15s, then backgrounds)
  bash [--cwd=<dir>] <cmd...>           Execute bash commands
  status <task_id>                      Poll status + drain output of a background task
  close <task_id>                       Delete a background task
  runner start|stop|status              Manage the task runner process (PM2)

Languages: nodejs (default), python, go, rust, c, cpp, java, deno, bash
`);
  }

  const [cmd, ...rest] = args;

  try {
    if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
      usage(); process.exit(0);
    }

    if (cmd === 'runner') {
      const sub = rest[0];
      if (sub === 'start') await cmdRunnerStart();
      else if (sub === 'stop') await cmdRunnerStop();
      else if (sub === 'status') await cmdRunnerStatus();
      else { process.stderr.write(`Unknown runner subcommand: ${sub}\n`); process.exit(1); }
      await printRunningTools();
      process.exit(0);
    }

    if (cmd === 'exec') {
      const { args: a, positional } = parseArgs(rest);
      await cmdExec(a, positional);
      process.exit(0);
    }

    if (cmd === 'bash') {
      const { args: a, positional } = parseArgs(rest);
      await cmdBash(a, positional);
      process.exit(0);
    }

    if (cmd === 'status') {
      if (!rest[0]) { process.stderr.write('Task ID required\n'); process.exit(1); }
      await cmdStatus(rest[0]);
      await printRunningTools();
      process.exit(0);
    }

    if (cmd === 'close') {
      if (!rest[0]) { process.stderr.write('Task ID required\n'); process.exit(1); }
      await cmdClose(rest[0]);
      await printRunningTools();
      process.exit(0);
    }

    process.stderr.write(`Unknown command: ${cmd}\n`);
    usage();
    process.exit(1);
  } catch (e) {
    process.stderr.write(`Error: ${e?.message || String(e)}\n`);
    process.exit(1);
  }
}
