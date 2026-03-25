import { spawn, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const IS_WIN = process.platform === 'win32';
const BM2_DIR = join(tmpdir(), 'bm2');

function ensureDir() {
  try { mkdirSync(BM2_DIR, { recursive: true }); } catch {}
}

function pidFile(name) { return join(BM2_DIR, name + '.pid'); }
function logFile(name, stream) { return join(BM2_DIR, name + '-' + stream + '.log'); }

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readPid(name) {
  try {
    const pid = parseInt(readFileSync(pidFile(name), 'utf8').trim(), 10);
    if (!isNaN(pid) && isAlive(pid)) return pid;
    try { unlinkSync(pidFile(name)); } catch {}
    return null;
  } catch { return null; }
}

export function start(name, script, args = []) {
  ensureDir();
  const existing = readPid(name);
  if (existing) kill(name);
  const outLog = logFile(name, 'out');
  const errLog = logFile(name, 'err');
  const { openSync, closeSync } = require('fs');
  const outFd = openSync(outLog, 'w');
  const errFd = openSync(errLog, 'w');
  const child = spawn('bun', [script, ...args], {
    detached: true,
    stdio: ['ignore', outFd, errFd],
    windowsHide: true,
  });
  writeFileSync(pidFile(name), String(child.pid));
  child.unref();
  closeSync(outFd);
  closeSync(errFd);
  return child.pid;
}

export function kill(name) {
  const pid = readPid(name);
  if (!pid) return false;
  try {
    if (IS_WIN) {
      spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(pid, 'SIGTERM');
      setTimeout(() => { try { process.kill(pid, 'SIGKILL'); } catch {} }, 3000);
    }
  } catch {}
  try { unlinkSync(pidFile(name)); } catch {}
  return true;
}

export function list() {
  ensureDir();
  const results = [];
  const { readdirSync } = require('fs');
  for (const f of readdirSync(BM2_DIR)) {
    if (!f.endsWith('.pid')) continue;
    const name = f.replace(/\.pid$/, '');
    const pid = readPid(name);
    results.push({ name, pid, status: pid ? 'online' : 'stopped' });
  }
  return results;
}

export function describe(name) {
  const pid = readPid(name);
  if (!pid) return null;
  return { name, pid, status: 'online' };
}
