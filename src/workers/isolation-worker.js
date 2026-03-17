import { parentPort } from 'worker_threads';
import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync, appendFileSync } from 'fs';
import path from 'path';
import os from 'os';

function findBin(...candidates) {
  const probe = process.platform === 'win32' ? (b) => `where ${b}` : (b) => `which ${b}`;
  for (const bin of candidates) {
    try {
      execSync(probe(bin), { stdio: 'ignore', timeout: 3000 });
      return bin;
    } catch {}
  }
  return candidates[0];
}

const PYTHON = findBin('python3', 'python');
const SHELL = process.platform === 'win32' ? 'cmd.exe' : findBin('bash', 'sh');
const DENO = findBin('deno');
const GO = findBin('go');
const RUSTC = findBin('rustc');
const GCC = findBin('gcc');
const GPP = findBin('g++');
const JAVA = findBin('java');
const JAVAC = findBin('javac');

const IS_WIN = process.platform === 'win32';

const POWERSHELL = findBin('pwsh', 'powershell');

const CONFIGS = {
  nodejs: { command: 'bun', args: ['-e'], inline: true },
  typescript: { command: 'bun', args: ['-e'], inline: true },
  deno: { command: DENO, args: ['run', '--no-check'], inline: false },
  bash: IS_WIN
    ? { command: SHELL, args: ['/c'], inline: true }
    : { command: SHELL, args: ['-c'], inline: true },
  cmd: { command: 'cmd.exe', args: ['/c'], inline: true },
  powershell: { command: POWERSHELL, args: ['-NoProfile', '-NonInteractive', '-Command'], inline: true },
  go: { command: GO, args: ['run'], inline: false },
  rust: { command: RUSTC, args: [], inline: false },
  python: { command: PYTHON, args: ['-c'], inline: true },
  c: { command: GCC, args: [], inline: false },
  cpp: { command: GPP, args: [], inline: false },
  java: { command: JAVAC, args: [], inline: false }
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
  const normalizedCwd = workingDirectory
    ? (IS_WIN ? workingDirectory.replace(/\//g, '\\') : workingDirectory)
    : process.cwd();
  workingDirectory = normalizedCwd;
  return new Promise((resolve) => {
    let child;
    let killed = false;
    let stdout = '';
    let stderr = '';
    let sigkillTimer = null;
    const logFile = path.join(os.tmpdir(), `glootie_log_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);

    const cleanup = () => {
      activeChild = null;
      if (sigkillTimer) { clearTimeout(sigkillTimer); sigkillTimer = null; }
      cleanupTemp();
    };

    const writeLog = (stream, data) => {
      try {
        const timestamp = new Date().toISOString();
        const prefix = stream === 'stdout' ? '[OUT]' : '[ERR]';
        const lines = data.toString('utf8').split('\n');
        for (const line of lines) {
          if (line.length > 0 || lines.indexOf(line) < lines.length - 1) {
            appendFileSync(logFile, `${timestamp} ${prefix} ${line}\n`);
          }
        }
      } catch (e) {}
    };

    try {
      const config = CONFIGS[runtime];
      if (!config) {
        return resolve({
          success: false, exitCode: 1, stdout: '',
          stderr: `Unsupported runtime: ${runtime}`, error: `Unsupported runtime: ${runtime}`, logFile
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
            stderr: `Failed to create temp file: ${e.message}`, error: `Failed to create temp file: ${e.message}`, logFile
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

          const binExt = IS_WIN ? '.exe' : '';
          const binName = `code${binExt}`;
          const args = runtime === 'go'
            ? ['run', filePath]
            : runtime === 'rust'
            ? [filePath, '-o', path.join(tempDir, binName)]
            : ['c', 'cpp'].includes(runtime)
            ? [filePath, '-o', path.join(tempDir, binName), '-I', workingDirectory]
            : [];

          const command = runtime === 'go' ? GO : runtime === 'rust' ? RUSTC : runtime === 'c' ? GCC : GPP;

          execChild = spawn(command, args, {
            cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false
          });

          activeChild = execChild;

          const timeoutHandle = setTimeout(() => {
            if (!execKilled) {
              execKilled = true;
              try {
                if (IS_WIN) {
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
                stderr: execStderr || err.message, error: `Process error: ${err.message}`, logFile
              });
            } else {
              cleanup();
            }
          });

          execChild.on('close', (execCode) => {
            if (!execKilled) {
              execKilled = true;
              clearTimeout(timeoutHandle);
              if (execCode === 0 && ['rust', 'c', 'cpp'].includes(runtime)) {
                writeLog('stdout', execStdout);
                writeLog('stderr', execStderr);
                const exePath = path.join(tempDir, binName);
                const runChild = spawn(exePath, [], { cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false });
                let runStdout = '';
                let runStderr = '';
                let runKilled = false;

                activeChild = runChild;
                const runTimeoutHandle = setTimeout(() => {
                  if (!runKilled) {
                    runKilled = true;
                    try {
                      if (IS_WIN) {
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
                    resolve({ success: runCode === 0, exitCode: runCode ?? 1, stdout: runStdout, stderr: runStderr, error: null, logFile });
                  } else {
                    cleanup();
                  }
                });

                runChild.on('error', (err) => {
                  if (!runKilled) {
                    runKilled = true;
                    clearTimeout(runTimeoutHandle);
                    cleanup();
                    resolve({ success: false, exitCode: 1, stdout: runStdout, stderr: runStderr || err.message, error: `Execution error: ${err.message}`, logFile });
                  } else {
                    cleanup();
                  }
                });
              } else {
                cleanup();
                resolve({ success: execCode === 0, exitCode: execCode ?? 1, stdout: execStdout, stderr: execStderr, error: null, logFile });
              }
            } else {
              cleanup();
            }
          });
        } catch (e) {
          cleanupTemp();
          return resolve({
            success: false, exitCode: 1, stdout: '',
            stderr: `Failed to create source file: ${e.message}`, error: `Failed to create source file: ${e.message}`, logFile
          });
        }
        return;
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

          (() => {
            const cpSeparator = IS_WIN ? ';' : ':';
            const compileClasspath = [tempDir, workingDirectory].join(cpSeparator);

            compileChild = spawn(JAVAC, ['-cp', compileClasspath, javaFile], {
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
                return resolve({
                  success: false, exitCode: 1, stdout: compileStdout,
                  stderr: compileStderr || `Compilation failed with exit code ${compileCode}`,
                  error: 'Java compilation failed', logFile
                });
              }

              let execChild;
              let execStderr = '';
              let execStdout = '';
              let execKilled = false;

              const classpath = [tempDir, workingDirectory].join(cpSeparator);

              execChild = spawn(JAVA, ['-cp', classpath, className], {
                cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'], timeout: processTimeout, detached: false
              });

              activeChild = execChild;

              const execTimeoutHandle = setTimeout(() => {
                if (!execKilled) {
                  execKilled = true;
                  try {
                    if (IS_WIN) {
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
                  resolve({
                    success: false, exitCode: 1, stdout: execStdout,
                    stderr: execStderr || err.message, error: `Runtime error: ${err.message}`, logFile
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
                  resolve({ success: execCode === 0, exitCode: execCode ?? 1, stdout: execStdout, stderr: execStderr, error: null, logFile });
                } else {
                  cleanup();
                }
              });
            });

            compileChild.on('error', (err) => {
              cleanupTemp();
              return resolve({
                success: false, exitCode: 1, stdout: '',
                stderr: err.message, error: `Compilation error: ${err.message}`, logFile
              });
            });
          })();
        } catch (e) {
          cleanupTemp();
          return resolve({
            success: false, exitCode: 1, stdout: '',
            stderr: `Failed to create Java file: ${e.message}`, error: `Failed to create Java file: ${e.message}`, logFile
          });
        }
        return;
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
            stderr: `Failed to create Deno file: ${e.message}`, error: `Failed to create Deno file: ${e.message}`, logFile
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
            if (IS_WIN) {
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

      child.stdout?.on('data', (data) => {
        try {
          const str = data.toString('utf8');
          stdout += str;
          writeLog('stdout', str);
          if (stdout.length > MAX_BUFFER) stdout = stdout.slice(-Math.ceil(MAX_BUFFER * 0.5));
          try { parentPort.postMessage({ jobId: currentJobId, type: 'output', streamType: 'stdout', data: str }); } catch (e) {}
        } catch (e) {}
      });

      child.stderr?.on('data', (data) => {
        try {
          const str = data.toString('utf8');
          stderr += str;
          writeLog('stderr', str);
          if (stderr.length > MAX_BUFFER) stderr = stderr.slice(-Math.ceil(MAX_BUFFER * 0.5));
          try { parentPort.postMessage({ jobId: currentJobId, type: 'output', streamType: 'stderr', data: str }); } catch (e) {}
        } catch (e) {}
      });

      child.on('error', (err) => {
        if (!killed) {
          killed = true;
          clearTimeout(timeoutHandle);
          cleanup();
          resolve({
            success: false, exitCode: 1, stdout,
            stderr: stderr || err.message, error: `Process error: ${err.message}`, logFile
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
          resolve({ success: exitCode === 0, exitCode: exitCode ?? 1, stdout, stderr, error: null, logFile });
        } else {
          cleanup();
        }
      });
    } catch (error) {
      cleanup();
      return resolve({
        success: false, exitCode: 1, stdout: '',
        stderr: error.message, error: error.message, logFile
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
