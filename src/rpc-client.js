import http from 'http';
import { readFileSync } from 'fs';

function getPort() {
  try {
    return parseInt(readFileSync('/tmp/glootie-runner.port', 'utf8').trim(), 10);
  } catch {
    throw new Error('task runner not available');
  }
}

function rpcCall(method, params, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const port = getPort();
    const body = JSON.stringify({ method, params });
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/rpc', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`task runner HTTP ${res.statusCode}: ${data}`));
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error));
            resolve(parsed.result);
          } catch {
            reject(new Error(`task runner invalid response: ${data}`));
          }
        });
      }
    );
    const timer = setTimeout(() => { req.destroy(); reject(new Error('task runner request timed out')); }, timeoutMs);
    req.on('error', (e) => { clearTimeout(timer); reject(new Error(`task runner not available: ${e.message}`)); });
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });
}

export async function executeCode(code, runtime, workingDirectory, timeout = 30000, backgroundTaskId = null) {
  const r = await rpcCall('execute', { code, runtime, workingDirectory, timeout, backgroundTaskId }, timeout + 5000);
  return r?.result ?? r;
}

export const backgroundStore = {
  createTask: (code, runtime, workingDirectory) => rpcCall('createTask', { code, runtime, workingDirectory }).then(r => r?.taskId ?? r),
  startTask: (taskId) => rpcCall('startTask', { taskId }),
  completeTask: (taskId, result) => rpcCall('completeTask', { taskId, result }),
  failTask: (taskId, error) => rpcCall('failTask', { taskId, error }),
  getTask: (taskId) => rpcCall('getTask', { taskId }).then(r => r?.task ?? r),
  deleteTask: (taskId) => rpcCall('deleteTask', { taskId }),
  appendOutput: (taskId, type, data) => rpcCall('appendOutput', { taskId, type, data }),
  getAndClearOutput: (taskId) => rpcCall('getAndClearOutput', { taskId }).then(r => r?.output ?? r),
};
