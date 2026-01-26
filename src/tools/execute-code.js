import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';
import { executeProcess, activeProcesses } from './process-manager.js';

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

export async function executeCode(code, runtime, workingDirectory, processId) {
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
     if (!config) {
       const supportedRuntimes = Object.keys(CONFIGS).join(', ');
       throw new Error(`Unsupported runtime: ${runtime}. Supported: ${supportedRuntimes}`);
     }

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
         const args = runtime === 'cmd'
           ? ['/c', `"${tempFile}"`]
           : [tempFile];
         return await executeProcess(config.command, args, { cwd: workingDirectory, processId, isBashCommand: runtime === 'bash' });
       } catch (e) {
         throw e;
       } finally {
         try { unlinkSync(tempFile); } catch (e) {}
       }
    }

     return await executeProcess(config.command, [...config.args, code], { cwd: workingDirectory, processId });
   } catch (error) {
     const errorMsg = error?.message || String(error);
     if (runtime === 'cmd' && errorMsg.includes('ENOENT')) {
       throw new Error(`CMD execution failed: cmd.exe not found. Ensure you're running on Windows.`);
     }
     throw new Error(`Code execution failed: ${errorMsg}`);
   }
}

export function validateExecuteParams(code, workingDirectory) {
  if (!code || typeof code !== 'string') {
    return { error: 'Error: code must be a non-empty string' };
  }
  if (!workingDirectory || typeof workingDirectory !== 'string') {
    return { error: 'Error: workingDirectory must be a non-empty string' };
  }
  return null;
}

export function validateBashParams(commands, workingDirectory) {
  if (!commands) {
    return { error: 'Error: commands must be provided' };
  }
  if (!workingDirectory || typeof workingDirectory !== 'string') {
    return { error: 'Error: workingDirectory must be a non-empty string' };
  }
  return null;
}
