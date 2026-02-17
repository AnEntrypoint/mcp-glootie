import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

const CONFIGS = {
  nodejs: { command: 'node', args: ['-e'], inline: true },
  typescript: { command: 'node', args: ['-e'], inline: true },
  deno: { command: 'deno', args: ['run', '--no-check'], inline: false },
  bash: { command: 'bash', args: ['-c'], inline: true },
  cmd: { command: 'cmd.exe', args: ['/c'], inline: true },
  go: { command: 'go', args: ['run'], inline: false },
  rust: { command: 'rustc', args: [], inline: false },
  python: { command: 'python3', args: ['-c'], inline: true },
  c: { command: 'gcc', args: [], inline: false },
  cpp: { command: 'g++', args: [], inline: false },
  java: { command: 'javac', args: [], inline: false }
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
      } else if (['go', 'rust', 'c', 'cpp'].includes(runtime)) {
        try {
          const tempDir = mkdtempSync(path.join(os.tmpdir(), 'glootie_'));
          activeTempDir = tempDir;
          const ext = runtime === 'go' ? '.go' : runtime === 'rust' ? '.rs' : runtime === 'c' ? '.c' : '.cpp';
          const fileName = `code${ext}`;
          const filePath = path.join(tempDir, fileName);
          writeFileSync(filePath, code);

          let execChild;
          let execStderr = '';
          let execStdout = '';
          let execKilled = false;

          const args = runtime === 'go'
            ? ['run', filePath]
            : runtime === 'rust'
            ? [filePath, '-o', path.join(tempDir, 'code')]
            : ['c', 'cpp'].includes(runtime)
            ? [filePath, '-o', path.join(tempDir, 'code'), '-I', workingDirectory]
            : [];

          const command = runtime === 'go' ? 'go' : runtime === 'rust' ? 'rustc' : runtime === 'c' ? 'gcc' : 'g++';

          execChild = spawn(command, args, {
            cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false
          });

          activeChild = execChild;

          const timeoutHandle = setTimeout(() => {
            if (!execKilled) {
              execKilled = true;
              try {
                if (process.platform === 'win32') {
                  spawn('taskkill', ['/pid', String(execChild.pid), '/t', '/f'], { stdio: 'ignore' });
                } else {
                  execChild.kill('SIGTERM');
                  setTimeout(() => {
                    try { if (execChild && !execChild.killed) execChild.kill('SIGKILL'); } catch (e) {}
                  }, SIGTERM_TIMEOUT);
                }
              } catch (e) {}
            }
          }, processTimeout);

          execChild.stdout?.on('data', (data) => {
            try {
              execStdout += data.toString('utf8');
              if (execStdout.length > MAX_BUFFER) execStdout = execStdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
            } catch (e) {}
          });

          execChild.stderr?.on('data', (data) => {
            try {
              execStderr += data.toString('utf8');
              if (execStderr.length > MAX_BUFFER) execStderr = execStderr.slice(-Math.ceil(MAX_BUFFER * 0.5));
            } catch (e) {}
          });

          execChild.on('error', (err) => {
            if (!execKilled) {
              execKilled = true;
              clearTimeout(timeoutHandle);
              cleanup();
              resolve({
                success: false, exitCode: 1, stdout: execStdout,
                stderr: execStderr || err.message, error: `Process error: ${err.message}`
              });
            } else {
              cleanup();
            }
          });

          execChild.on('close', (execCode) => {
            if (!execKilled) {
              execKilled = true;
              clearTimeout(timeoutHandle);
              cleanup();
              if (execCode === 0 && ['rust', 'c', 'cpp'].includes(runtime)) {
                const exePath = path.join(tempDir, 'code');
                const runChild = spawn(exePath, [], { cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false });
                let runStdout = '';
                let runStderr = '';
                let runKilled = false;

                activeChild = runChild;
                const runTimeoutHandle = setTimeout(() => {
                  if (!runKilled) {
                    runKilled = true;
                    try {
                      if (process.platform === 'win32') {
                        spawn('taskkill', ['/pid', String(runChild.pid), '/t', '/f'], { stdio: 'ignore' });
                      } else {
                        runChild.kill('SIGTERM');
                        setTimeout(() => {
                          try { if (runChild && !runChild.killed) runChild.kill('SIGKILL'); } catch (e) {}
                        }, SIGTERM_TIMEOUT);
                      }
                    } catch (e) {}
                  }
                }, processTimeout);

                runChild.stdout?.on('data', (data) => {
                  try {
                    runStdout += data.toString('utf8');
                    if (runStdout.length > MAX_BUFFER) runStdout = runStdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
                  } catch (e) {}
                });

                runChild.stderr?.on('data', (data) => {
                  try {
                    runStderr += data.toString('utf8');
                    if (runStderr.length > MAX_BUFFER) runStderr = runStderr.slice(-Math.ceil(MAX_BUFFER * 0.5));
                  } catch (e) {}
                });

                runChild.on('close', (runCode) => {
                  if (!runKilled) {
                    runKilled = true;
                    clearTimeout(runTimeoutHandle);
                    cleanup();
                    resolve({ success: runCode === 0, exitCode: runCode ?? 1, stdout: runStdout, stderr: runStderr, error: null });
                  } else {
                    cleanup();
                  }
                });

                runChild.on('error', (err) => {
                  if (!runKilled) {
                    runKilled = true;
                    clearTimeout(runTimeoutHandle);
                    cleanup();
                    resolve({ success: false, exitCode: 1, stdout: runStdout, stderr: runStderr || err.message, error: `Execution error: ${err.message}` });
                  } else {
                    cleanup();
                  }
                });
              } else {
                resolve({ success: execCode === 0, exitCode: execCode ?? 1, stdout: execStdout, stderr: execStderr, error: null });
              }
            } else {
              cleanup();
            }
          });
        } catch (e) {
          cleanupTemp();
          return resolve({
            success: false, exitCode: 1, stdout: '',
            stderr: `Failed to create source file: ${e.message}`, error: `Failed to create source file: ${e.message}`
          });
        }
      } else if (runtime === 'java') {
        try {
          const tempDir = mkdtempSync(path.join(os.tmpdir(), 'glootie_'));
          activeTempDir = tempDir;
          const className = 'Main';
          const javaFile = path.join(tempDir, `${className}.java`);
          const wrappedCode = `public class ${className} {\n  public static void main(String[] args) {\n${code.split('\n').map(line => '    ' + line).join('\n')}\n  }\n}`;
          writeFileSync(javaFile, wrappedCode);

          let compileChild;
          let compileStderr = '';
          let compileStdout = '';

          return new Promise((compileResolve) => {
            const cpSeparator = process.platform === 'win32' ? ';' : ':';
            const compileClasspath = [tempDir, workingDirectory].join(cpSeparator);

            compileChild = spawn('javac', ['-cp', compileClasspath, javaFile], {
              cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout
            });

            compileChild.stdout?.on('data', (data) => {
              compileStdout += data.toString('utf8');
            });

            compileChild.stderr?.on('data', (data) => {
              compileStderr += data.toString('utf8');
            });

            compileChild.on('close', (compileCode) => {
              if (compileCode !== 0) {
                cleanupTemp();
                return compileResolve({
                  success: false, exitCode: 1, stdout: compileStdout,
                  stderr: compileStderr || `Compilation failed with exit code ${compileCode}`,
                  error: 'Java compilation failed'
                });
              }

              let execChild;
              let execStderr = '';
              let execStdout = '';
              let execKilled = false;

              const cpSeparator = process.platform === 'win32' ? ';' : ':';
              const classpath = [tempDir, workingDirectory].join(cpSeparator);

              execChild = spawn('java', ['-cp', classpath, className], {
                cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false
              });

              activeChild = execChild;

              const execTimeoutHandle = setTimeout(() => {
                if (!execKilled) {
                  execKilled = true;
                  try {
                    if (process.platform === 'win32') {
                      spawn('taskkill', ['/pid', String(execChild.pid), '/t', '/f'], { stdio: 'ignore' });
                    } else {
                      execChild.kill('SIGTERM');
                      setTimeout(() => {
                        try { if (execChild && !execChild.killed) execChild.kill('SIGKILL'); } catch (e) {}
                      }, SIGTERM_TIMEOUT);
                    }
                  } catch (e) {}
                }
              }, processTimeout);

              execChild.stdout?.on('data', (data) => {
                try {
                  execStdout += data.toString('utf8');
                  if (execStdout.length > MAX_BUFFER) execStdout = execStdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
                } catch (e) {}
              });

              execChild.stderr?.on('data', (data) => {
                try {
                  execStderr += data.toString('utf8');
                  if (execStderr.length > MAX_BUFFER) execStderr = execStderr.slice(-Math.ceil(MAX_BUFFER * 0.5));
                } catch (e) {}
              });

              execChild.on('error', (err) => {
                if (!execKilled) {
                  execKilled = true;
                  clearTimeout(execTimeoutHandle);
                  cleanup();
                  compileResolve({
                    success: false, exitCode: 1, stdout: execStdout,
                    stderr: execStderr || err.message, error: `Runtime error: ${err.message}`
                  });
                } else {
                  cleanup();
                }
              });

              execChild.on('close', (execCode) => {
                if (!execKilled) {
                  execKilled = true;
                  clearTimeout(execTimeoutHandle);
                  cleanup();
                  compileResolve({ success: execCode === 0, exitCode: execCode ?? 1, stdout: execStdout, stderr: execStderr, error: null });
                } else {
                  cleanup();
                }
              });
            });

            compileChild.on('error', (err) => {
              cleanupTemp();
              return compileResolve({
                success: false, exitCode: 1, stdout: '',
                stderr: err.message, error: `Compilation error: ${err.message}`
              });
            });
          });
        } catch (e) {
          cleanupTemp();
          return resolve({
            success: false, exitCode: 1, stdout: '',
            stderr: `Failed to create Java file: ${e.message}`, error: `Failed to create Java file: ${e.message}`
          });
        }
      } else if (runtime === 'deno') {
        try {
          const tempDir = mkdtempSync(path.join(os.tmpdir(), 'glootie_'));
          activeTempDir = tempDir;
          const tsFile = path.join(tempDir, 'code.ts');
          writeFileSync(tsFile, code);
          child = spawn(config.command, [...config.args, tsFile], {
            cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false
          });
        } catch (e) {
          cleanupTemp();
          return resolve({
            success: false, exitCode: 1, stdout: '',
            stderr: `Failed to create Deno file: ${e.message}`, error: `Failed to create Deno file: ${e.message}`
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

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let outputTimer = null;
      
      const flushOutput = () => {
        if (parentPort && currentJobId) {
          if (stdoutBuffer.length > 0) {
            try { parentPort.postMessage({ jobId: currentJobId, type: 'output', streamType: 'stdout', data: stdoutBuffer }); } catch (e) {}
            stdoutBuffer = '';
          }
          if (stderrBuffer.length > 0) {
            try { parentPort.postMessage({ jobId: currentJobId, type: 'output', streamType: 'stderr', data: stderrBuffer }); } catch (e) {}
            stderrBuffer = '';
          }
        }
        outputTimer = null;
      };
      
      const scheduleFlush = () => {
        if (!outputTimer) outputTimer = setTimeout(flushOutput, 200);
      };

      child.stdout?.on('data', (data) => {
        try {
          stdout += data.toString('utf8');
          stdoutBuffer += data.toString('utf8');
          if (stdout.length > MAX_BUFFER) stdout = stdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
          scheduleFlush();
        } catch (e) {}
      });

      child.stderr?.on('data', (data) => {
        try {
          stderr += data.toString('utf8');
          stderrBuffer += data.toString('utf8');
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
