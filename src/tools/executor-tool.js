import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
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

const activeProcesses = new Map();
const BACKGROUND_THRESHOLD = 60000;

function executeProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    try {
      const startTime = Date.now();
      let child;

      try {
        child = spawn(command, args, { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (e) {
        return reject(new Error(`Failed to spawn process: ${e?.message || String(e)}`));
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const processId = options.processId;
      activeProcesses.set(processId, { child, startTime, stdout: '', stderr: '' });

      const cleanupProcess = () => {
        try {
          if (child && !child.killed) {
            child.kill('SIGTERM');
            setTimeout(() => {
              if (child && !child.killed) child.kill('SIGKILL');
            }, 5000);
          }
        } catch (e) {}
        activeProcesses.delete(processId);
      };

      const handleError = (error) => {
        if (timedOut) return;
        timedOut = true;
        cleanupProcess();
        reject(error);
      };

      const handleData = (isStderr, data) => {
        try {
          const chunk = data.toString('utf8');
          if (isStderr) {
            stderr += chunk;
          } else {
            stdout += chunk;
          }
          if (activeProcesses.has(processId)) {
            const proc = activeProcesses.get(processId);
            if (isStderr) {
              proc.stderr += chunk;
            } else {
              proc.stdout += chunk;
            }
          }
        } catch (e) {}
      };

      child.stdout?.on('data', (d) => handleData(false, d));
      child.stderr?.on('data', (d) => handleData(true, d));

      child.on('close', (code) => {
        if (timedOut) return;
        timedOut = true;
        cleanupProcess();
        resolve({
          success: code === 0,
          stdout,
          stderr: code !== 0 ? stderr : '',
          executionTimeMs: Date.now() - startTime,
          code
        });
      });

      child.on('error', (error) => {
        handleError(new Error(`Process error: ${error?.message || String(error)}`));
      });

      child.on('disconnect', () => {
        if (!timedOut && !child.killed) {
          handleError(new Error('Process disconnected unexpectedly'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function executeCode(code, runtime, workingDirectory, processId) {
  try {
    if (!code || typeof code !== 'string') {
      throw new Error('Invalid code: must be non-empty string');
    }
    if (!runtime || typeof runtime !== 'string') {
      throw new Error('Invalid runtime specified');
    }
    if (!workingDirectory || typeof workingDirectory !== 'string') {
      throw new Error('Invalid workingDirectory specified');
    }

    const config = CONFIGS[runtime];
    if (!config) throw new Error(`Unsupported runtime: ${runtime}`);

    if (['bash', 'cmd'].includes(runtime)) {
      const ext = runtime === 'bash' ? '.sh' : '.bat';
      const script = runtime === 'bash'
        ? `#!/bin/bash\nset -e\n${code}`
        : `@echo off\nsetlocal enabledelayedexpansion\n${code}`;

      let tempFile;
      try {
        tempFile = path.join(os.tmpdir(), `glootie_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
        writeFileSync(tempFile, script);
      } catch (e) {
        throw new Error(`Failed to create temp file: ${e?.message || String(e)}`);
      }

      try {
        return await executeProcess(config.command, [tempFile], { cwd: workingDirectory, processId });
      } catch (e) {
        throw e;
      } finally {
        try { unlinkSync(tempFile); } catch (e) {}
      }
    }

    return await executeProcess(config.command, [...config.args, code], { cwd: workingDirectory, processId });
  } catch (error) {
    throw new Error(`Code execution failed: ${error?.message || String(error)}`);
  }
}

const baseExecuteTool = {
  name: 'execute',
  description: 'Execute code (JS/TS, Deno, Go, Rust, Python, C, C++)',
  inputSchema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
      code: { type: 'string', description: 'Code to execute' },
      language: { type: 'string', enum: ['nodejs', 'typescript', 'deno', 'go', 'rust', 'python', 'c', 'cpp', 'auto'], description: 'Language (default: auto)' }
    },
    required: ['workingDirectory', 'code']
  },
  handler: async ({ code, workingDirectory, language = 'auto' }) => {
    const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      if (!code || typeof code !== 'string') {
        return {
          content: [{ type: 'text', text: 'Error: code must be a non-empty string' }],
          isError: true
        };
      }
      if (!workingDirectory || typeof workingDirectory !== 'string') {
        return {
          content: [{ type: 'text', text: 'Error: workingDirectory must be a non-empty string' }],
          isError: true
        };
      }

      const runtime = language === 'typescript' ? 'nodejs' : (language || 'nodejs');

      const resultPromise = executeCode(code, runtime, workingDirectory, processId);

      const result = await Promise.race([
        resultPromise,
        new Promise(resolve => setTimeout(() => resolve(null), BACKGROUND_THRESHOLD))
      ]);

      if (result === null) {
        const proc = activeProcesses.get(processId);
        const resourceUri = `glootie://process/${processId}`;
        const currentOutput = proc?.stdout || '(no output yet)';
        return {
          content: [{
            type: 'text',
            text: `Process backgrounded. ID: ${processId}\nResource: ${resourceUri}\nElapsed: ${BACKGROUND_THRESHOLD}ms\nCurrent output:\n${currentOutput}`
          }],
          isError: false
        };
      }

      return {
        content: [{ type: 'text', text: result.success ? (result.stdout || 'Success') : result.stderr }],
        isError: !result.success
      };
    } catch (error) {
      activeProcesses.delete(processId);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }],
        isError: true
      };
    }
  }
};

const windowsTools = [
  baseExecuteTool,
  {
    name: 'cmd',
    description: 'Execute Windows Command Prompt commands',
    inputSchema: {
      type: 'object',
      properties: {
        workingDirectory: { type: 'string', description: 'Working directory' },
        commands: { type: ['string', 'array'], description: 'Commands to execute' },
        language: { type: 'string', enum: ['cmd', 'powershell'], description: 'Language (default: cmd)' }
      },
      required: ['workingDirectory', 'commands']
    },
    handler: async ({ commands, workingDirectory, language = 'cmd' }) => {
      const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      try {
        if (!commands) {
          return {
            content: [{ type: 'text', text: 'Error: commands must be provided' }],
            isError: true
          };
        }
        if (!workingDirectory || typeof workingDirectory !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: workingDirectory must be a non-empty string' }],
            isError: true
          };
        }

        const cmd = Array.isArray(commands) ? commands.join(' & ') : String(commands);

        const resultPromise = executeCode(cmd, 'cmd', workingDirectory, processId);

        const result = await Promise.race([
          resultPromise,
          new Promise(resolve => setTimeout(() => resolve(null), BACKGROUND_THRESHOLD))
        ]);

        if (result === null) {
          const proc = activeProcesses.get(processId);
          const resourceUri = `glootie://process/${processId}`;
          const currentOutput = proc?.stdout || '(no output yet)';
          return {
            content: [{
              type: 'text',
              text: `Process backgrounded. ID: ${processId}\nResource: ${resourceUri}\nElapsed: ${BACKGROUND_THRESHOLD}ms\nCurrent output:\n${currentOutput}`
            }],
            isError: false
          };
        }

        return {
          content: [{ type: 'text', text: result.success ? (result.stdout || 'Success') : result.stderr }],
          isError: !result.success
        };
      } catch (error) {
        activeProcesses.delete(processId);
        return {
          content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }],
          isError: true
        };
      }
    }
  }
];

const unixTools = [
  baseExecuteTool,
  {
    name: 'bash',
    description: 'Execute bash shell commands',
    inputSchema: {
      type: 'object',
      properties: {
        workingDirectory: { type: 'string', description: 'Working directory' },
        commands: { type: ['string', 'array'], description: 'Commands to execute' },
        language: { type: 'string', enum: ['bash', 'sh', 'zsh'], description: 'Language (default: bash)' }
      },
      required: ['workingDirectory', 'commands']
    },
    handler: async ({ commands, workingDirectory, language = 'bash' }) => {
      const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      try {
        if (!commands) {
          return {
            content: [{ type: 'text', text: 'Error: commands must be provided' }],
            isError: true
          };
        }
        if (!workingDirectory || typeof workingDirectory !== 'string') {
          return {
            content: [{ type: 'text', text: 'Error: workingDirectory must be a non-empty string' }],
            isError: true
          };
        }

        const cmd = Array.isArray(commands) ? commands.join(' && ') : String(commands);

        const resultPromise = executeCode(cmd, 'bash', workingDirectory, processId);

        const result = await Promise.race([
          resultPromise,
          new Promise(resolve => setTimeout(() => resolve(null), BACKGROUND_THRESHOLD))
        ]);

        if (result === null) {
          const proc = activeProcesses.get(processId);
          const resourceUri = `glootie://process/${processId}`;
          const currentOutput = proc?.stdout || '(no output yet)';
          return {
            content: [{
              type: 'text',
              text: `Process backgrounded. ID: ${processId}\nResource: ${resourceUri}\nElapsed: ${BACKGROUND_THRESHOLD}ms\nCurrent output:\n${currentOutput}`
            }],
            isError: false
          };
        }

        return {
          content: [{ type: 'text', text: result.success ? (result.stdout || 'Success') : result.stderr }],
          isError: !result.success
        };
      } catch (error) {
        activeProcesses.delete(processId);
        return {
          content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }],
          isError: true
        };
      }
    }
  }
];

export const executionTools = process.platform === 'win32' ? windowsTools : unixTools;

export function getProcessStatus(processId) {
  const proc = activeProcesses.get(processId);
  if (!proc) return { error: 'Process not found', processId };

  const elapsed = Date.now() - proc.startTime;
  return {
    processId,
    elapsed,
    stdout: proc.stdout,
    stderr: proc.stderr,
    running: true
  };
}
