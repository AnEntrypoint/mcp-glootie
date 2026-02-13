import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

const CONFIGS = {
  nodejs: { command: 'node', args: ['-e'] },
  typescript: { command: 'node', args: ['-e'] },
  deno: { command: 'deno', args: ['eval', '--no-check'] },
  bash: { command: 'bash', args: ['-c'] },
  cmd: { command: 'cmd.exe', args: ['/c'] },
  go: { command: 'go', args: ['run'] },
  rust: { command: 'rustc', args: [] },
  python: { command: 'python3', args: ['-c'] },
  c: { command: 'gcc', args: [] },
  cpp: { command: 'g++', args: [] }
};

const MAX_BUFFER = 10 * 1024 * 1024;
const SIGTERM_TIMEOUT = 5000;

let activeChild = null;
let activeTempDir = null;

function cleanupTemp() {
  if (activeTempDir) {
    try { rmSync(activeTempDir, { recursive: true, force: true }); } catch (e) {}
    activeTempDir = null;
  }
}

function killActiveChild() {
  if (activeChild) {
    try { activeChild.kill('SIGKILL'); } catch (e) {}
    activeChild = null;
  }
  cleanupTemp();
}

parentPort.on('close', killActiveChild);

async function executeInProcess(code, runtime, workingDirectory, processTimeout) {
  return new Promise((resolve) => {
    let child;
    let killed = false;
    let stdout = '';
    let stderr = '';
    let sigkillTimer = null;

    const cleanup = () => {
      activeChild = null;
      if (sigkillTimer) { clearTimeout(sigkillTimer); sigkillTimer = null; }
      cleanupTemp();
    };

    try {
      const config = CONFIGS[runtime];
      if (!config) {
        return resolve({
          success: false, exitCode: 1, stdout: '',
          stderr: `Unsupported runtime: ${runtime}`, error: `Unsupported runtime: ${runtime}`
        });
      }

      if (['bash', 'cmd'].includes(runtime)) {
        try {
          const tempDir = mkdtempSync(path.join(os.tmpdir(), 'glootie_'));
          activeTempDir = tempDir;
          const ext = runtime === 'bash' ? '.sh' : '.bat';
          const script = runtime === 'bash'
            ? `#!/bin/bash\nset -e\n${code}`
            : `@echo off\nsetlocal enabledelayedexpansion\n${code}`;
          const scriptFile = path.join(tempDir, `script${ext}`);
          writeFileSync(scriptFile, script);
          child = spawn(config.command,
            runtime === 'cmd' ? ['/c', scriptFile] : [scriptFile],
            { cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false }
          );
        } catch (e) {
          cleanupTemp();
          return resolve({
            success: false, exitCode: 1, stdout: '',
            stderr: `Failed to create temp file: ${e.message}`, error: `Failed to create temp file: ${e.message}`
          });
        }
      } else {
        child = spawn(config.command, [...config.args, code], {
          cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false
        });
      }

      activeChild = child;

      const timeoutHandle = setTimeout(() => {
        if (!killed) {
          killed = true;
          try {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
            } else {
              child.kill('SIGTERM');
              sigkillTimer = setTimeout(() => {
                try { if (child && !child.killed) child.kill('SIGKILL'); } catch (e) {}
              }, SIGTERM_TIMEOUT);
            }
          } catch (e) {}
        }
      }, processTimeout);

      let outputDirty = false;
      let outputTimer = null;
      const flushOutput = () => {
        if (outputDirty && parentPort && currentJobId) {
          try { parentPort.postMessage({ jobId: currentJobId, type: 'output', stdout, stderr }); } catch (e) {}
          outputDirty = false;
        }
        outputTimer = null;
      };
      const scheduleFlush = () => {
        outputDirty = true;
        if (!outputTimer) outputTimer = setTimeout(flushOutput, 500);
      };

      child.stdout?.on('data', (data) => {
        try {
          stdout += data.toString('utf8');
          if (stdout.length > MAX_BUFFER) stdout = stdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
          scheduleFlush();
        } catch (e) {}
      });

      child.stderr?.on('data', (data) => {
        try {
          stderr += data.toString('utf8');
          if (stderr.length > MAX_BUFFER) stderr = stderr.slice(-Math.ceil(MAX_BUFFER * 0.5));
          scheduleFlush();
        } catch (e) {}
      });

      child.on('error', (err) => {
        if (!killed) {
          killed = true;
          clearTimeout(timeoutHandle);
          cleanup();
          resolve({
            success: false, exitCode: 1, stdout,
            stderr: stderr || err.message, error: `Process error: ${err.message}`
          });
        } else {
          cleanup();
        }
      });

      child.on('close', (exitCode) => {
        if (!killed) {
          killed = true;
          clearTimeout(timeoutHandle);
          cleanup();
          resolve({ success: exitCode === 0, exitCode: exitCode ?? 1, stdout, stderr, error: null });
        } else {
          cleanup();
        }
      });
    } catch (error) {
      cleanup();
      return resolve({
        success: false, exitCode: 1, stdout: '',
        stderr: error.message, error: error.message
      });
    }
  });
}

let currentJobId = null;

parentPort.on('message', async (msg) => {
  const { jobId, code, runtime, workingDirectory, timeout = 30000 } = msg;
  currentJobId = jobId;
  try {
    const result = await executeInProcess(code, runtime, workingDirectory, timeout);
    try {
      parentPort.postMessage({
        jobId, type: 'complete', stdout: result.stdout,
        stderr: result.stderr, exitCode: result.exitCode, error: result.error
      });
    } catch (postErr) {
      process.stderr.write(`[Worker] Failed to send completion for job ${jobId}: ${postErr.message}\n`);
    }
  } catch (err) {
    try {
      parentPort.postMessage({ jobId, type: 'error', error: err.message });
    } catch (postErr) {
      process.stderr.write(`[Worker] Failed to send error for job ${jobId}: ${postErr.message}\n`);
    }
  }
  currentJobId = null;
});

parentPort.on('error', () => {});
