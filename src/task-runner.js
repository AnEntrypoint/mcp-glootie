import http from 'http';
import { writeFileSync } from 'fs';
import { WorkerPool } from './workers/worker-pool.js';
import { BackgroundTaskStore } from './background-tasks.js';

const pool = new WorkerPool(4);
const backgroundStore = new BackgroundTaskStore();

function randomPort() {
  return Math.floor(Math.random() * 10000) + 30000;
}

async function tryListen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

async function startServer() {
  const server = http.createServer(handleRequest);
  for (let i = 0; i < 10; i++) {
    const port = randomPort();
    try {
      await tryListen(server, port);
      writeFileSync('/tmp/glootie-runner.port', String(port));
      return server;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
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
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function handleRPC(body) {
  const { method, params = {} } = body;
  switch (method) {
    case 'execute': {
      const { code, runtime, workingDirectory, timeout, backgroundTaskId } = params;
      const result = await pool.execute(code, runtime, workingDirectory, timeout, backgroundTaskId);
      return { result };
    }
    case 'createTask': {
      const { code, runtime, workingDirectory } = params;
      const taskId = backgroundStore.createTask(code, runtime, workingDirectory);
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
    case 'getTask': {
      const task = backgroundStore.getTask(params.taskId);
      return { task };
    }
    case 'deleteTask':
      if (backgroundStore.deleteTask) backgroundStore.deleteTask(params.taskId);
      return {};
    case 'appendOutput':
      backgroundStore.appendOutput(params.taskId, params.type, params.data);
      return {};
    case 'getAndClearOutput': {
      const output = backgroundStore.getAndClearOutput(params.taskId);
      return { output };
    }
    case 'shutdown':
      setImmediate(gracefulShutdown);
      return { ok: true };
    default:
      throw Object.assign(new Error(`Unknown method: ${method}`), { code: -32601 });
  }
}

async function handleRequest(req, res) {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return sendJSON(res, 200, { ok: true });
    }
    if (req.method === 'POST' && req.url === '/rpc') {
      const body = await readBody(req);
      try {
        const result = await handleRPC(body);
        return sendJSON(res, 200, { id: body.id, result });
      } catch (e) {
        return sendJSON(res, 200, {
          id: body.id,
          error: { code: e.code || -32603, message: e.message }
        });
      }
    }
    sendJSON(res, 404, { error: 'Not found' });
  } catch (e) {
    try { sendJSON(res, 400, { error: e.message }); } catch (_) {}
  }
}

let server;

async function gracefulShutdown() {
  await pool.shutdown();
  backgroundStore.shutdown();
  if (server) server.close(() => process.exit(0));
  else process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server = await startServer();
