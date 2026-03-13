#!/usr/bin/env bun
import http from 'http';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const pm2lib = require('pm2');

const __dirname = dirname(fileURLToPath(import.meta.url));
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
      process.stderr.write(`  Tip: gm-exec sleep <task_id>   # wait for a task (default 30s timeout)\n`);
      process.stderr.write(`       gm-exec status <task_id>  # check task status\n`);
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
  throw new Error('Runner did not become healthy in time');
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
    const partial = await rpcCall('getAndClearOutput', { taskId: result.backgroundTaskId ?? taskId }).then(r => r?.output ?? r).catch(() => []);
    if (Array.isArray(partial) && partial.length) {
      for (const entry of partial) {
        if (entry.s === 'stdout') process.stdout.write(entry.d);
        else process.stderr.write(entry.d);
      }
    }
    console.log(`\nStill running after 15s — backgrounded.`);
    console.log(`Task ID: ${id}\n`);
    console.log(`  gm-exec sleep ${id}       # wait for completion (up to 30s) — recommended`);
    console.log(`  gm-exec status ${id}      # drain output buffer (snapshot)`);
    console.log(`  gm-exec close ${id}       # delete task when done`);
    console.log(`  gm-exec runner stop       # stop runner when all tasks done`);
    console.log(`\nRunner kept alive: ${PM2_NAME} (PM2)`);
    return 0;
  }

  if (result.backgroundTaskId && result.completed) {
    await rpcCall('deleteTask', { taskId: result.backgroundTaskId }).catch(() => {});
  } else {
    await rpcCall('deleteTask', { taskId }).catch(() => {});
  }

  if (autoStarted) await stopRunner();

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) { process.stderr.write(`Error: ${result.error}\n`); return 1; }

  const exitCode = result.exitCode ?? result.code ?? 0;
  return result.success === false ? (exitCode || 1) : 0;
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
    if (await healthCheck()) { console.log(`Runner started on port ${readFileSync(PORT_FILE, 'utf8').trim()}`); return; }
  }
  throw new Error('Runner did not become healthy');
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
  if (env.status === 'online') {
    console.log(`\nRunner is active. If you have background tasks:`);
    console.log(`  gm-exec sleep <task_id>      # wait for task completion (up to 30s)`);
    console.log(`  gm-exec status <task_id>     # check task status`);
    console.log(`  gm-exec runner stop          # stop runner when all tasks done`);
  }
}

async function cmdExec(cmdArgs, positional) {
  let code = positional.join(' ');
  if (cmdArgs.file) code = readFileSync(resolve(cmdArgs.file), 'utf8');
  if (!code.trim()) { process.stderr.write('No code provided\n'); usage(); return 1; }
  const cwd = resolve(cmdArgs.cwd || process.cwd());
  let runtime = cmdArgs.lang || 'nodejs';
  if (runtime === 'typescript' || runtime === 'auto') runtime = 'nodejs';
  return await runCode(code, runtime, cwd);
}

async function cmdBash(cmdArgs, positional) {
  const commands = positional.join(' ');
  if (!commands.trim()) { process.stderr.write('No commands provided\n'); usage(); return 1; }
  return await runCode(commands, 'bash', resolve(cmdArgs.cwd || process.cwd()));
}

async function cmdStatus(taskId) {
  const autoStarted = await ensureRunner();
  const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
  const task = await rpcCall('getTask', { taskId: rawId }).then(r => r?.task ?? r);
  if (!task) {
    if (autoStarted) await stopRunner();
    throw Object.assign(new Error('Task not found'), { exitCode: 1, silent: true });
  }
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
      if (entry.s === 'stdout') process.stdout.write(entry.d);
      else process.stderr.write(entry.d);
    }
  }
  if (task.status === 'running') {
    console.log(`\nTask still running. Options:`);
    console.log(`  gm-exec sleep ${taskId}      # wait for completion (up to 30s) — recommended`);
    console.log(`  gm-exec status ${taskId}     # check status again (snapshot)`);
  } else if (task.status === 'completed' || task.status === 'failed') {
    console.log(`\nTask finished. Clean up:`);
    console.log(`  gm-exec close ${taskId}      # delete task`);
    console.log(`  gm-exec runner stop          # stop runner if no more tasks`);
  }
  if (autoStarted) await stopRunner();
}

async function cmdClose(taskId) {
  const autoStarted = await ensureRunner();
  const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
  await rpcCall('deleteTask', { taskId: rawId });
  const res = await rpcCall('listTasks', {}).catch(() => ({ tasks: [] }));
  const remaining = (res?.tasks ?? []).filter(t => t.status === 'running' || t.status === 'pending');
  console.log(`Task ${taskId} closed`);
  if (remaining.length > 0) {
    console.log(`\n${remaining.length} task(s) still running:`);
    for (const t of remaining) {
      console.log(`  gm-exec sleep task_${t.id}       # wait for completion (up to 30s)`);
    }
  } else {
    console.log(`  gm-exec runner stop          # no more tasks — stop runner`);
    if (autoStarted) await stopRunner();
  }
}

async function cmdSleep(taskId, timeoutSeconds) {
  const autoStarted = await ensureRunner();
  const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
  const timeout = (parseInt(timeoutSeconds, 10) || 30) * 1000;
  const startTime = Date.now();

  async function drainOutput() {
    const output = await rpcCall('getAndClearOutput', { taskId: rawId }).then(r => r?.output ?? r).catch(() => []);
    if (Array.isArray(output)) {
      for (const entry of output) {
        if (entry.s === 'stdout') process.stdout.write(entry.d);
        else process.stderr.write(entry.d);
      }
    }
  }

  while (Date.now() - startTime < timeout) {
    const task = await rpcCall('getTask', { taskId: rawId }).then(r => r?.task ?? r).catch(() => null);
    if (!task) break;
    await drainOutput();
    if (task.status !== 'running' && task.status !== 'pending') {
      if (task.result) {
        const r = task.result;
        if (r.error) process.stderr.write(`Error: ${r.error}\n`);
      }
      console.log(`\nTask finished (${task.status}). Clean up:`);
      console.log(`  gm-exec close ${taskId}      # delete task`);
      console.log(`  gm-exec runner stop          # stop runner if no more tasks`);
      if (autoStarted) await stopRunner();
      return;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  await drainOutput();
  console.log(`\nTimeout after ${timeout / 1000}s. Task still running.`);
  console.log(`  gm-exec sleep ${taskId}       # wait again (up to 30s) — recommended`);
  console.log(`  gm-exec status ${taskId}      # check current status (snapshot)`);
  if (autoStarted) await stopRunner();
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
  console.log(`gm-exec — code execution CLI

Usage:
  gm-exec <command> [options]

Commands:
  exec [--lang=<lang>] [--cwd=<dir>] [--file=<path>] <code>
                          Execute code (waits up to 15s, then backgrounds)
  bash [--cwd=<dir>] <cmd...>
                          Execute bash commands
  status <task_id>        Poll status + drain output of a background task
  sleep <task_id> [seconds]
                          Wait for task completion (default 30s timeout)
  close <task_id>         Delete a background task
  runner start|stop|status
                          Manage the task runner process (PM2)

Languages: nodejs (default), python, go, rust, c, cpp, java, deno, bash
`);
}

const [cmd, ...rest] = process.argv.slice(2);

let exitCode = 0;
try {
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    usage();
  } else if (cmd === 'runner') {
    const sub = rest[0];
    if (sub === 'start') await cmdRunnerStart();
    else if (sub === 'stop') await cmdRunnerStop();
    else if (sub === 'status') await cmdRunnerStatus();
    else { process.stderr.write(`Unknown runner subcommand: ${sub}\n`); exitCode = 1; }
  } else if (cmd === 'exec') {
    const { args, positional } = parseArgs(rest);
    exitCode = (await cmdExec(args, positional)) ?? 0;
  } else if (cmd === 'bash') {
    const { args, positional } = parseArgs(rest);
    exitCode = (await cmdBash(args, positional)) ?? 0;
  } else if (cmd === 'status') {
    if (!rest[0]) { process.stderr.write('Task ID required\n'); exitCode = 1; }
    else await cmdStatus(rest[0]);
  } else if (cmd === 'sleep') {
    if (!rest[0]) { process.stderr.write('Task ID required\n'); exitCode = 1; }
    else await cmdSleep(rest[0], rest[1]);
  } else if (cmd === 'close') {
    if (!rest[0]) { process.stderr.write('Task ID required\n'); exitCode = 1; }
    else await cmdClose(rest[0]);
  } else {
    process.stderr.write(`Unknown command: ${cmd}\n`);
    usage();
    exitCode = 1;
  }
} catch (e) {
  if (!e?.silent) process.stderr.write(`Error: ${e?.message || String(e)}\n`);
  exitCode = e?.exitCode ?? 1;
} finally {
  await printRunningTools();
  process.exit(exitCode);
}
