import { globalPool } from '../workers/worker-pool.js';

const validate = {
  execute({ code, workingDirectory }) {
    if (!code || typeof code !== 'string') return 'Error: code must be a non-empty string';
    if (!workingDirectory || typeof workingDirectory !== 'string') return 'Error: workingDirectory must be a non-empty string';
    return null;
  },
  bash({ commands, workingDirectory }) {
    if (!commands) return 'Error: commands must be provided';
    if (!workingDirectory || typeof workingDirectory !== 'string') return 'Error: workingDirectory must be a non-empty string';
    return null;
  }
};

export async function executeCode(code, runtime, workingDirectory, timeout = 30000) {
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

    const supportedRuntimes = ['nodejs', 'typescript', 'deno', 'bash', 'cmd', 'go', 'rust', 'python', 'c', 'cpp'];
    if (!supportedRuntimes.includes(runtime)) {
      throw new Error(`Unsupported runtime: ${runtime}. Supported: ${supportedRuntimes.join(', ')}`);
    }

    const result = await globalPool.execute(code, runtime, workingDirectory, timeout);

    return {
      success: result.success,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      code: result.exitCode,
      executionTimeMs: result.executionTimeMs,
      error: result.error ? result.error.message : null
    };
  } catch (error) {
    throw new Error(`Code execution failed: ${error?.message || String(error)}`);
  }
}

export { validate };
