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

function executeProcess(command, args, options) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn(command, args, { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    const timeoutId = setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        stdout,
        stderr: `Timeout after ${options.timeout}ms`,
        executionTimeMs: Date.now() - startTime
      });
    }, options.timeout || 240000);

    child.stdout?.on('data', (d) => { stdout += d.toString('utf8'); });
    child.stderr?.on('data', (d) => { stderr += d.toString('utf8'); });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      resolve({
        success: code === 0,
        stdout,
        stderr: code !== 0 ? stderr : '',
        executionTimeMs: Date.now() - startTime,
        code
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        stdout,
        stderr: `Error: ${error.message}`,
        executionTimeMs: Date.now() - startTime
      });
    });
  });
}

async function executeCode(code, runtime, workingDirectory, timeout) {
  const config = CONFIGS[runtime];
  if (!config) throw new Error(`Unsupported runtime: ${runtime}`);

  if (['bash', 'cmd'].includes(runtime)) {
    const ext = runtime === 'bash' ? '.sh' : '.bat';
    const script = runtime === 'bash'
      ? `#!/bin/bash\nset -e\n${code}`
      : `@echo off\nsetlocal enabledelayedexpansion\n${code}`;

    const tempFile = path.join(os.tmpdir(), `glootie_${Date.now()}${ext}`);
    writeFileSync(tempFile, script);

    try {
      return await executeProcess(config.command, [tempFile], { cwd: workingDirectory, timeout });
    } finally {
      try { unlinkSync(tempFile); } catch {}
    }
  }

  return executeProcess(config.command, [...config.args, code], { cwd: workingDirectory, timeout });
}

const baseExecuteTool = {
  name: 'execute',
  description: 'Execute code (JS/TS, Deno, Go, Rust, Python, C, C++)',
  inputSchema: {
    type: 'object',
    properties: {
      workingDirectory: { type: 'string', description: 'Working directory' },
      code: { type: 'string', description: 'Code to execute' },
      language: { type: 'string', enum: ['nodejs', 'typescript', 'deno', 'go', 'rust', 'python', 'c', 'cpp', 'auto'], description: 'Language (default: auto)' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 240000)' }
    },
    required: ['workingDirectory', 'code']
  },
  handler: async ({ code, workingDirectory, language = 'auto', timeout = 240000 }) => {
    try {
      const runtime = language === 'typescript' ? 'nodejs' : language;
      const result = await executeCode(code, runtime, workingDirectory, timeout);
      return {
        content: [{ type: 'text', text: result.success ? (result.stdout || 'Success') : result.stderr }],
        isError: !result.success
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
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
        language: { type: 'string', enum: ['cmd', 'powershell'], description: 'Language (default: cmd)' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 240000)' }
      },
      required: ['workingDirectory', 'commands']
    },
    handler: async ({ commands, workingDirectory, language = 'cmd', timeout = 240000 }) => {
      try {
        const cmd = Array.isArray(commands) ? commands.join(' & ') : commands;
        const result = await executeCode(cmd, 'cmd', workingDirectory, timeout);
        return {
          content: [{ type: 'text', text: result.success ? (result.stdout || 'Success') : result.stderr }],
          isError: !result.success
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
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
        language: { type: 'string', enum: ['bash', 'sh', 'zsh'], description: 'Language (default: bash)' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 240000)' }
      },
      required: ['workingDirectory', 'commands']
    },
    handler: async ({ commands, workingDirectory, language = 'bash', timeout = 240000 }) => {
      try {
        const cmd = Array.isArray(commands) ? commands.join(' && ') : commands;
        const result = await executeCode(cmd, 'bash', workingDirectory, timeout);
        return {
          content: [{ type: 'text', text: result.success ? (result.stdout || 'Success') : result.stderr }],
          isError: !result.success
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  }
];

export const executionTools = process.platform === 'win32' ? windowsTools : unixTools;
