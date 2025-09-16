

import { spawn } from 'child_process';
import { createErrorResponse, createSuccessResponse, createTimeoutError, handleProcessError } from './common-errors.js';

export async function executeProcess(command, args = [], options = {}) {
  const startTime = Date.now();
  const { timeout = 120000, cwd, input, encoding = 'utf8' } = options;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: input ? 'pipe' : ['pipe', 'pipe', 'pipe'] 
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        child.kill('SIGTERM');
        isResolved = true;
        resolve(createTimeoutError(`${command} ${args.join(' ')}`, timeout, startTime));
      }
    }, timeout);

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        if (data && typeof data === 'object' && Buffer.isBuffer(data)) {
          stdout += data.toString(encoding);
        } else if (data && typeof data === 'string') {
          stdout += data;
        }
        
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        if (data && typeof data === 'object' && Buffer.isBuffer(data)) {
          stderr += data.toString(encoding);
        } else if (data && typeof data === 'string') {
          stderr += data;
        }
        
      });
    }

    child.on('close', (code, signal) => {
      if (!isResolved) {
        clearTimeout(timeoutId);
        isResolved = true;

        if (code === 0) {
          resolve(createSuccessResponse({ stdout, stderr, code, signal }, startTime));
        } else {
          resolve(createErrorResponse(
            stderr || `Process exited with code ${code}`,
            startTime,
            { stdout, stderr, code, signal }
          ));
        }
      }
    });

    child.on('error', (error) => {
      if (!isResolved) {
        clearTimeout(timeoutId);
        isResolved = true;
        resolve(handleProcessError(error, `${command} ${args.join(' ')}`, startTime));
      }
    });

    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

export async function executeNodeCode(code, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  
  return executeProcess('node', ['-e', code], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}

export async function executeDenoCode(code, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  
  return executeProcess('deno', ['eval', '--no-check', code], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}

export async function executeBashCommands(commands, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  const commandString = Array.isArray(commands) ? commands.join(' && ') : commands;
  
  return executeProcess('bash', ['-c', commandString], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}