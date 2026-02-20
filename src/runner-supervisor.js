import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH = path.join(__dirname, 'task-runner.js');

const PORT_FILE = '/tmp/glootie-runner.port';
const MAX_RESTARTS = 10;
const RESTART_WINDOW_MS = 5 * 60 * 1000;

let runnerProcess = null;
let healthPollInterval = null;
let healthy = false;
let consecutiveFailures = 0;
let restartTimestamps = [];

function getPort() {
  try {
    const val = fs.readFileSync(PORT_FILE, 'utf8').trim();
    const n = Number(val);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function healthCheck(port) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function withinWindow() {
  const now = Date.now();
  restartTimestamps = restartTimestamps.filter(t => now - t < RESTART_WINDOW_MS);
  return restartTimestamps.length;
}

async function startRunner() {
  try { fs.unlinkSync(PORT_FILE); } catch {}

  runnerProcess = spawn('node', [RUNNER_PATH], {
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit']
  });

  runnerProcess.on('exit', (code) => {
    healthy = false;
    runnerProcess = null;
    const count = withinWindow();
    if (count >= MAX_RESTARTS) {
      console.error('[runner-supervisor] max restarts exceeded, stopping');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, count), 30000);
    restartTimestamps.push(Date.now());
    setTimeout(() => startRunner().catch(e => console.error('[runner-supervisor] restart failed', e)), delay);
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    const port = getPort();
    if (port && await healthCheck(port)) {
      healthy = true;
      consecutiveFailures = 0;
      startHealthPoll();
      return;
    }
  }
  throw new Error('runner did not become healthy within 10s');
}

function startHealthPoll() {
  if (healthPollInterval) clearInterval(healthPollInterval);
  healthPollInterval = setInterval(async () => {
    const port = getPort();
    const ok = port ? await healthCheck(port) : false;
    if (ok) {
      healthy = true;
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        healthy = false;
        const count = withinWindow();
        if (count >= MAX_RESTARTS) {
          console.error('[runner-supervisor] max restarts exceeded');
          clearInterval(healthPollInterval);
          healthPollInterval = null;
          return;
        }
        restartTimestamps.push(Date.now());
        const delay = Math.min(1000 * Math.pow(2, count), 30000);
        await stopRunner();
        setTimeout(() => startRunner().catch(e => console.error('[runner-supervisor] restart failed', e)), delay);
      }
    }
  }, 5000);
}

async function stopRunner() {
  if (healthPollInterval) { clearInterval(healthPollInterval); healthPollInterval = null; }
  if (!runnerProcess) return;
  const proc = runnerProcess;
  return new Promise((resolve) => {
    const kill = setTimeout(() => { proc.kill('SIGKILL'); }, 3000);
    proc.on('exit', () => { clearTimeout(kill); resolve(); });
    proc.kill('SIGTERM');
  });
}

function isRunnerHealthy() {
  return healthy;
}

export { startRunner, stopRunner, isRunnerHealthy };
