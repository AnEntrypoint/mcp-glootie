#!/usr/bin/env bun
import http from 'http';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const pm2lib = require('pm2');

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNNER_SCRIPT = resolve(__dirname, 'task-runner.js');
const PORT_FILE = '/tmp/glootie-runner.port';
const PM2_NAME = 'mcp-gm-runner';
const HARD_CEILING_MS = 15000;

// --- PM2 lib wrappers ---

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

// --- Running tools footer ---

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

// --- Health check ---

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
  if (await healthCheck()) return;
  process.stderr.write('Starting task runner via PM2...\n');
  await withPm2(async () => {
    await pm2delete(PM2_NAME).catch(() => {});
    await pm2start({
      script: 'bun',
      args: RUNNER_SCRIPT,
      name: PM2_NAME,
      autorestart: false,
      watch: false,
    });
  });
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await healthCheck()) return;
  }
  process.stderr.write('Runner did not become healthy in time\n');
  process.exit(1);
}

// --- RPC ---

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

// --- Execution (shared by exec and bash) ---

async function runCode(code, runtime, workingDirectory) {
  const taskId = await rpcCall('createTask', { code, runtime, workingDirectory })
    .then(r => r?.taskId ?? r);

  const safetyTimeout = new Promise(r => {
    setTimeout(async () => {
      await rpcCall('startTask', { taskId }).catch(() => {});
      r({ persisted: true, backgroundTaskId: taskId });
    }, HARD_CEILING_MS);
  });

  const result = await Promise.race([
    rpcCall(
      'execute',
      { code, runtime, workingDirectory, timeout: HARD_CEILING_MS, backgroundTaskId: taskId },
      HARD_CEILING_MS + 5000
    ).then(r => r?.result ?? r),
    safetyTimeout,
  ]);

  if (result.persisted || (result.backgroundTaskId && !result.completed)) {
    const id = `task_${result.backgroundTaskId ?? taskId}`;
    console.log(`Backgrounded after 15s — task still running.`);
    console.log(`Task ID: ${id}`);
    console.log(``);
    console.log(`Watch output:`);
    console.log(`  mcp-gm-cli status ${id}    # drain buffered output + status`);
    console.log(`  mcp-gm-cli close ${id}     # clean up when done`);
    console.log(`  node node_modules/.bin/pm2 logs ${PM2_NAME}   # stream runner logs`);
    await printRunningTools();
    process.exit(0);
  }

  if (result.backgroundTaskId && result.completed) {
    await rpcCall('deleteTask', { taskId: result.backgroundTaskId }).catch(() => {});
  } else {
    await rpcCall('deleteTask', { taskId }).catch(() => {});
  }

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

// --- Commands ---

async function cmdRunnerStart() {
  if (await healthCheck()) {
    const port = readFileSync(PORT_FILE, 'utf8').trim();
    console.log(`Runner already healthy on port ${port}`);
    return;
  }
  await withPm2(async () => {
    await pm2delete(PM2_NAME).catch(() => {});
    await pm2start({
      script: 'bun',
      args: RUNNER_SCRIPT,
      name: PM2_NAME,
      autorestart: false,
      watch: false,
    });
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
  await withPm2(() => pm2delete(PM2_NAME).catch(() => {}));
  console.log('Runner stopped');
}

async function cmdRunnerStatus() {
  const desc = await withPm2(() => pm2describe(PM2_NAME).catch(() => []));
  if (!desc || desc.length === 0) {
    console.log(`${PM2_NAME}: not found`);
    return;
  }
  const p = desc[0];
  const env = p.pm2_env || {};
  const uptime = env.pm_uptime ? Math.floor((Date.now() - env.pm_uptime) / 1000) + 's' : 'n/a';
  console.log(`name:    ${p.name}`);
  console.log(`status:  ${env.status}`);
  console.log(`pid:     ${p.pid}`);
  console.log(`uptime:  ${uptime}`);
  console.log(`restarts: ${env.restart_time ?? 0}`);
  if (existsSync(PORT_FILE)) {
    console.log(`port:    ${readFileSync(PORT_FILE, 'utf8').trim()}`);
  }
}

async function cmdExec(args, positional) {
  await ensureRunner();
  let code = positional.join(' ');
  if (args.file) code = readFileSync(resolve(args.file), 'utf8');
  if (!code.trim()) { process.stderr.write('No code provided\n'); usage(); process.exit(1); }
  const cwd = resolve(args.cwd || process.cwd());
  let runtime = args.lang || 'nodejs';
  if (runtime === 'typescript' || runtime === 'auto') runtime = 'nodejs';
  await runCode(code, runtime, cwd);
}

async function cmdBash(args, positional) {
  await ensureRunner();
  const commands = positional.join(' ');
  if (!commands.trim()) { process.stderr.write('No commands provided\n'); usage(); process.exit(1); }
  const cwd = resolve(args.cwd || process.cwd());
  await runCode(commands, 'bash', cwd);
}

async function cmdStatus(taskId) {
  await ensureRunner();
  const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
  const task = await rpcCall('getTask', { taskId: rawId }).then(r => r?.task ?? r);
  if (!task) { console.log('Task not found'); process.exit(1); }

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
}

async function cmdClose(taskId) {
  await ensureRunner();
  const rawId = parseInt(taskId.replace(/^task_/, ''), 10);
  await rpcCall('deleteTask', { taskId: rawId });
  console.log(`Task ${taskId} closed`);
}

// --- Arg parsing ---

function parseArgs(argv) {
  const args = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        args[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) { args[key] = next; i++; }
        else args[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { args, positional };
}

function usage() {
  console.log(`mcp-gm-cli — CLI for mcp-gm code execution

Usage:
  mcp-gm-cli <command> [options]

Commands:
  runner start                  Start the task runner via PM2 (no autorestart)
  runner stop                   Stop and remove the task runner
  runner status                 Show runner status

  exec [options] <code>         Execute code, wait up to 15s then background
    --lang=<lang>               nodejs (default), python, go, rust, c, cpp, java, deno
    --cwd=<dir>                 Working directory (default: current dir)
    --file=<path>               Read code from file

  bash [--cwd=<dir>] <cmd...>   Execute bash commands, same 15s ceiling

  status <task_id>              Poll status + drain output of a background task
  close <task_id>               Delete a background task

  help                          Show this help

Notes:
  - Execution has a hard 15s ceiling. If the process is still running after
    that, it is backgrounded and you get a task ID with monitoring instructions.
  - Runner is managed by PM2 (lib) with autorestart=false, watch=false.
`);
}

// --- Main ---

const [,, cmd, ...rest] = process.argv;

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
    const { args, positional } = parseArgs(rest);
    await cmdExec(args, positional);
    process.exit(0);
  }

  if (cmd === 'bash') {
    const { args, positional } = parseArgs(rest);
    await cmdBash(args, positional);
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
