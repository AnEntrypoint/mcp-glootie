import http from 'http';
import { writeFileSync, unlinkSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir, homedir } from 'os';
import { fileURLToPath } from 'url';
import { backgroundStore } from './background-tasks.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXEC_PROCESS_SCRIPT = resolve(__dirname, 'exec-process.js');
const PORT_FILE = join(tmpdir(), 'glootie-runner.port');

const activeProcesses = new Map(); // taskId -> Subprocess

function randomPort() { return Math.floor(Math.random() * 10000) + 30000; }

async function tryListen(server, port) {
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve()); });
}

async function cleanupStaleProcesses() {
  // Kill any tracked active processes from a previous runner session
  for (const [taskId, proc] of activeProcesses) {
    try {
      const IS_WIN = process.platform === 'win32';
      if (IS_WIN) {
        const { spawnSync } = require('child_process');
        spawnSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {}
  }
  activeProcesses.clear();
}

async function startServer() {
  await cleanupStaleProcesses();
  const server = http.createServer(handleRequest);
  for (let i = 0; i < 10; i++) {
    const port = randomPort();
    try { await tryListen(server, port); writeFileSync(PORT_FILE, String(port)); return server; }
    catch (e) { if (e.code !== 'EADDRINUSE') throw e; }
  }
  throw new Error('Could not bind port after 10 attempts');
}

function sendJSON(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function startExecProcess(taskId, code, runtime, workingDirectory) {
  const codeFile = join(tmpdir(), 'gm-exec-code-' + taskId + '.mjs');
  writeFileSync(codeFile, code);
  const currentPort = parseInt(readFileSync(PORT_FILE, 'utf8').trim(), 10);
  const IS_WIN = process.platform === 'win32';
  const logDir = join(homedir(), '.pm2', 'logs');
  try { mkdirSync(logDir, { recursive: true }); } catch {}
  const outLogPath = join(logDir, 'gm-exec-task-' + taskId + '-out.log');
  const errLogPath = join(logDir, 'gm-exec-task-' + taskId + '-error.log');

  const proc = Bun.spawn(['bun', EXEC_PROCESS_SCRIPT], {
    env: {
      ...process.env,
      TASK_ID: String(taskId),
      PORT: String(currentPort),
      RUNTIME: runtime,
      CWD: workingDirectory,
      CODE_FILE: codeFile,
    },
    cwd: workingDirectory || process.cwd(),
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    windowsHide: true,
  });

  activeProcesses.set(taskId, proc);
  backgroundStore.startTask(taskId);

  // Pipe stdout to log file + let exec-process handle RPC
  (async () => {
    const outStream = Bun.file(outLogPath).writer();
    for await (const chunk of proc.stdout) {
      const str = new TextDecoder().decode(chunk);
      outStream.write(str);
    }
    outStream.flush();
  })().catch(() => {});

  (async () => {
    const errStream = Bun.file(errLogPath).writer();
    for await (const chunk of proc.stderr) {
      const str = new TextDecoder().decode(chunk);
      errStream.write(str);
    }
    errStream.flush();
  })().catch(() => {});

  // Handle process exit
  proc.exited.then((code) => {
    activeProcesses.delete(taskId);
  }).catch(() => {});
}

async function pollForCompletion(taskId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = backgroundStore.getTask(taskId);
    if (task && task.status !== 'running' && task.status !== 'pending') return task;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

async function handleRPC(body) {
  const { method, params = {} } = body;
  switch (method) {
    case 'execute': {
      const { code, runtime, workingDirectory, timeout, backgroundTaskId: taskId } = params;
      await startExecProcess(taskId, code, runtime, workingDirectory);
      const task = await pollForCompletion(taskId, timeout || 15000);
      if (task) {
        process.stderr.write('[runner] execute-delete taskId=' + taskId + ' status=' + task.status + '\n');
        activeProcesses.delete(taskId);
        backgroundStore.deleteTask(taskId);
        return { result: { success: task.result?.success === true, stdout: task.result?.stdout || '', stderr: task.result?.stderr || '', error: task.result?.error || null, exitCode: task.result?.exitCode ?? (task.result?.success ? 0 : 1), backgroundTaskId: taskId, completed: true } };
      }
      return { result: { backgroundTaskId: taskId, persisted: true } };
    }
    case 'createTask': {
      const taskId = backgroundStore.createTask(params.code, params.runtime, params.workingDirectory);
      return { taskId };
    }
    case 'startTask':
      backgroundStore.startTask(params.taskId);
      return {};
    case 'completeTask':
      backgroundStore.completeTask(params.taskId, params.result);
      return {};
    case 'failTask':
      backgroundStore.failTask(params.taskId, new Error(params.error));
      return {};
    case 'getTask':
      return { task: backgroundStore.getTask(params.taskId) };
    case 'deleteTask': {
      const proc = activeProcesses.get(params.taskId);
      process.stderr.write('[runner] deleteTask ' + params.taskId + ' pid=' + proc?.pid + '\n');
      activeProcesses.delete(params.taskId);
      backgroundStore.deleteTask(params.taskId);
      if (proc) {
        try {
          const IS_WIN = process.platform === 'win32';
          if (IS_WIN) {
            const { spawnSync } = require('child_process');
            spawnSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
          } else {
            proc.kill('SIGTERM');
          }
        } catch {}
      }
      return {};
    }
    case 'listTasks':
      return { tasks: backgroundStore.getAllTasks().map(t => ({ id: t.id, status: t.status })) };
    case 'pm2list': {
      const processes = [];
      for (const [taskId, proc] of activeProcesses) {
        processes.push({
          name: 'gm-exec-task-' + taskId,
          status: 'online',
          pid: proc.pid,
          uptime: null
        });
      }
      return { processes };
    }
    case 'appendOutput':
      backgroundStore.appendOutput(params.taskId, params.type, params.data);
      return {};
    case 'getAndClearOutput':
      return { output: backgroundStore.getAndClearOutput(params.taskId) };
    case 'waitForOutput': {
      const result = await backgroundStore.waitForOutput(params.taskId, params.timeoutMs);
      return result;
    }
    case 'sendStdin': {
      const proc = activeProcesses.get(params.taskId);
      if (!proc || !proc.stdin) return { ok: false };
      try {
        proc.stdin.write(new TextEncoder().encode(params.data));
        proc.stdin.flush();
        return { ok: true };
      } catch { return { ok: false }; }
    }
    case 'shutdown':
      setImmediate(gracefulShutdown);
      return { ok: true };
    default:
      throw Object.assign(new Error('Unknown method: ' + method), { code: -32601 });
  }
}

async function handleRequest(req, res) {
  try {
    if (req.method === 'GET' && req.url === '/health') return sendJSON(res, 200, { ok: true });
    if (req.method === 'POST' && req.url === '/rpc') {
      const body = await readBody(req);
      process.stderr.write('[rpc] ' + body.method + ' ' + JSON.stringify(body.params).slice(0,80) + '\n');
      try { return sendJSON(res, 200, { id: body.id, result: await handleRPC(body) }); }
      catch (e) { return sendJSON(res, 200, { id: body.id, error: { code: e.code || -32603, message: e.message } }); }
    }
    sendJSON(res, 404, { error: 'Not found' });
  } catch (e) { try { sendJSON(res, 400, { error: e.message }); } catch (_) {} }
}

async function gracefulShutdown() {
  backgroundStore.shutdown();
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

let server = await startServer();
