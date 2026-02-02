import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'fs';
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

async function executeInProcess(code, runtime, workingDirectory, processTimeout) {
  return new Promise((resolve) => {
    let child;
    let killed = false;
    let stdout = '';
    let stderr = '';
    const startTime = Date.now();
    let tempDir = null;

    try {
      const config = CONFIGS[runtime];
      if (!config) {
        return resolve({
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: `Unsupported runtime: ${runtime}`,
          error: `Unsupported runtime: ${runtime}`
        });
      }

      if (['bash', 'cmd'].includes(runtime)) {
        try {
          tempDir = mkdtempSync(path.join(os.tmpdir(), 'glootie_'));
          const ext = runtime === 'bash' ? '.sh' : '.bat';
          const script = runtime === 'bash'
            ? `#!/bin/bash\nset -e\n${code}`
            : `@echo off\nsetlocal enabledelayedexpansion\n${code}`;

          const scriptFile = path.join(tempDir, `script${ext}`);
          writeFileSync(scriptFile, script);

          const args = runtime === 'cmd'
            ? ['/c', scriptFile]
            : [scriptFile];

          child = spawn(config.command, args, {
            cwd: workingDirectory,
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: processTimeout,
            detached: false
          });
        } catch (e) {
          return resolve({
            success: false,
            exitCode: 1,
            stdout: '',
            stderr: `Failed to create temp file: ${e.message}`,
            error: `Failed to create temp file: ${e.message}`
          });
        }
      } else {
        child = spawn(config.command, [...config.args, code], {
          cwd: workingDirectory,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: processTimeout,
          detached: false
        });
      }

      const timeoutHandle = setTimeout(() => {
        if (!killed) {
          killed = true;
          try {
            if (process.platform === 'win32') {
              require('child_process').execSync(`taskkill /pid ${child.pid} /t /f`, { stdio: 'ignore' });
            } else {
              child.kill('SIGTERM');
              setTimeout(() => {
                if (child && !child.killed) {
                  child.kill('SIGKILL');
                }
              }, SIGTERM_TIMEOUT);
            }
          } catch (e) {}
        }
      }, processTimeout);

      child.stdout?.on('data', (data) => {
        try {
          const chunk = data.toString('utf8');
          stdout += chunk;
          if (stdout.length > MAX_BUFFER) {
            stdout = stdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
          }
        } catch (e) {}
      });

      child.stderr?.on('data', (data) => {
        try {
          const chunk = data.toString('utf8');
          stderr += chunk;
          if (stderr.length > MAX_BUFFER) {
            stderr = stderr.slice(-Math.ceil(MAX_BUFFER * 0.5));
          }
        } catch (e) {}
      });

      child.on('error', (err) => {
        if (!killed) {
          killed = true;
          clearTimeout(timeoutHandle);
          resolve({
            success: false,
            exitCode: 1,
            stdout,
            stderr: stderr || err.message,
            error: `Process error: ${err.message}`
          });
        }
      });

      child.on('close', (code) => {
        if (!killed) {
          killed = true;
          clearTimeout(timeoutHandle);
          resolve({
            success: code === 0,
            exitCode: code || 1,
            stdout,
            stderr,
            error: null
          });
        }
      });
    } catch (error) {
      return resolve({
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        error: error.message
      });
    } finally {
      setTimeout(() => {
        if (tempDir) {
          try {
            rmSync(tempDir, { recursive: true, force: true });
          } catch (e) {}
        }
      }, 1000);
    }
  });
}

parentPort.on('message', async (msg) => {
  const { jobId, code, runtime, workingDirectory, timeout = 30000 } = msg;

  try {
    const result = await executeInProcess(code, runtime, workingDirectory, timeout);

    parentPort.postMessage({
      jobId,
      type: 'complete',
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error
    });
  } catch (err) {
    parentPort.postMessage({
      jobId,
      type: 'error',
      error: err.message
    });
  }
});

parentPort.on('error', (err) => {
  process.stderr.write(`Worker error: ${err.message}\n`);
});
