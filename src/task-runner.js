import http from 'http';
import { writeFileSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { backgroundStore } from './background-tasks.js';

const pm2lib = require('pm2');
const __dirname = dirname(fileURLToPath(import.meta.url));
const EXEC_PROCESS_SCRIPT = resolve(__dirname, 'exec-process.js');
const PORT_FILE = join(tmpdir(), 'glootie-runner.port');
const taskPm2Ids = new Map();

function withPm2(fn) {
  return new Promise((resolve, reject) => {
    pm2lib.connect(err => {
      if (err) return reject(err);
      Promise.resolve().then(fn).then(r => { pm2lib.disconnect(); resolve(r); }).catch(e => { pm2lib.disconnect(); reject(e); });
    });
  });
}

function randomPort() { return Math.floor(Math.random() * 10000) + 30000; }

async function tryListen(server, port) {
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve()); });
}

async function startServer() {
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
  const currentPort = parseInt(require('fs').readFileSync(PORT_FILE, 'utf8').trim(), 10);
  const name = 'gm-exec-task-' + taskId;
  const apps = await withPm2(() => new Promise((res, rej) =>
    pm2lib.start({
      script: 'bun', args: [EXEC_PROCESS_SCRIPT], name,
      exec_mode: 'fork', autorestart: false, watch: false,
      env: { TASK_ID: String(taskId), PORT: String(currentPort), RUNTIME: runtime, CWD: workingDirectory, CODE_FILE: codeFile }
    }, (err, apps) => err ? rej(err) : res(apps))
  ));
  const pm2Id = apps?.[0]?.pm2_env?.pm_id;
  if (pm2Id != null) taskPm2Ids.set(taskId, pm2Id);
  backgroundStore.startTask(taskId);
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
      if (task) return { result: { success: task.status === 'completed', stdout: task.result?.stdout || '', stderr: task.result?.stderr || '', exitCode: task.result?.exitCode ?? 0, backgroundTaskId: taskId, completed: true } };
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
      const pm2Id = taskPm2Ids.get(params.taskId);
      taskPm2Ids.delete(params.taskId);
      backgroundStore.deleteTask(params.taskId);
      if (pm2Id != null) await withPm2(() => new Promise(r => pm2lib.delete('gm-exec-task-' + params.taskId, () => r()))).catch(() => {});
      return {};
    }
    case 'listTasks':
      return { tasks: backgroundStore.getAllTasks().map(t => ({ id: t.id, status: t.status })) };
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
      const pm2Id = taskPm2Ids.get(params.taskId);
      if (pm2Id == null) return { ok: false };
      await withPm2(() => new Promise((res, rej) =>
        pm2lib.sendDataToProcessId({ id: pm2Id, data: { type: 'stdin', data: params.data }, topic: 'stdin' }, err => err ? rej(err) : res())
      )).catch(() => {});
      return { ok: true };
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
