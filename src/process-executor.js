// Process execution utilities for MCP REPL
// Consolidates spawn/child_process patterns with consistent error handling

import { spawn } from 'child_process';
import { createErrorResponse, createSuccessResponse, createTimeoutError, handleProcessError } from './common-errors.js';

/**
 * Execute a process with consistent error handling and timeout support
 */
export async function executeProcess(command, args = [], options = {}) {
  const startTime = Date.now();
  const { timeout = 120000, cwd, input, encoding = 'utf8' } = options;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: input ? 'pipe' : ['pipe', 'pipe', 'pipe'] // Always capture stdout/stderr
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Setup timeout
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        child.kill('SIGTERM');
        isResolved = true;
        resolve(createTimeoutError(`${command} ${args.join(' ')}`, timeout, startTime));
      }
    }, timeout);

    // Collect output
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString(encoding);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString(encoding);
      });
    }

    // Handle process completion
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

    // Handle process errors
    child.on('error', (error) => {
      if (!isResolved) {
        clearTimeout(timeoutId);
        isResolved = true;
        resolve(handleProcessError(error, `${command} ${args.join(' ')}`, startTime));
      }
    });

    // Send input if provided
    if (input && child.stdin) {
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

/**
 * Execute Node.js code with consistent error handling
 */
export async function executeNodeCode(code, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  
  return executeProcess('node', ['-e', code], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}

/**
 * Execute Deno code with consistent error handling
 */
export async function executeDenoCode(code, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  
  return executeProcess('deno', ['eval', '--no-check', code], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}

/**
 * Execute bash commands with consistent error handling
 */
export async function executeBashCommands(commands, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  const commandString = Array.isArray(commands) ? commands.join(' && ') : commands;
  
  return executeProcess('bash', ['-c', commandString], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}