import { executeCode, validate } from './execute-code-isolated.js';
import { backgroundStore } from '../background-tasks.js';

const HARD_CEILING_MS = 15000;

const formatters = {
  output(result) {
    const parts = result.stdout ? [`[STDOUT]\n${result.stdout}`] : [];
    if (result.stderr) parts.push(`[STDERR]\n${result.stderr}`);
    return parts.length ? parts.join('\n\n') : '(no output)';
  },
  context(result) {
    const ctx = [`Exit code: ${result.code}`, `Time: ${result.executionTimeMs}ms`];
    if (result.stdout) ctx.push(`Stdout size: ${result.stdout.length} bytes`);
    if (result.stderr) ctx.push(`Stderr size: ${result.stderr.length} bytes`);
    return ctx.join(' | ');
  }
};

const response = {
  success(text) { return { content: [{ type: 'text', text }], isError: false }; },
  error(text) { return { content: [{ type: 'text', text }], isError: true }; }
};

const createExecutionHandler = (validateFn, isBash = false) => async (args) => {
  const { code, commands, workingDirectory, language = isBash ? 'bash' : 'auto', run_in_background } = args;

  try {
    const params = isBash ? { commands, workingDirectory } : { code, workingDirectory };
    const err = validate[isBash ? 'bash' : 'execute'](params);
    if (err) return response.error(err);

    const cmd = isBash ? (Array.isArray(commands) ? commands.join(' && ') : String(commands)) : code;
    let runtime = language || 'nodejs';
    if (!isBash && (runtime === 'typescript' || runtime === 'auto')) runtime = 'nodejs';

    const backgroundTaskId = backgroundStore.createTask(cmd, runtime, workingDirectory);

    const timeout = HARD_CEILING_MS;
    const deadline = Date.now() + timeout;
    
    const safetyTimeout = new Promise(resolve => {
      const remaining = Math.max(100, deadline - Date.now());
      setTimeout(() => {
        backgroundStore.startTask(backgroundTaskId);
        resolve({ backgroundTaskId, persisted: true });
      }, remaining);
    });
    
    const result = await Promise.race([
      executeCode(cmd, runtime, workingDirectory, timeout, backgroundTaskId),
      safetyTimeout
    ]);

    if (result.persisted) {
      return response.success(
        `Process backgrounded (ID: task_${result.backgroundTaskId}). Check status with process_status tool or resource task://${result.backgroundTaskId}`
      );
    }

    if (result.backgroundTaskId && result.completed) {
      return response.success(
        `Process completed in background (ID: task_${result.backgroundTaskId}). Output available as resource task://${result.backgroundTaskId}`
      );
    }

    backgroundStore.deleteTask(backgroundTaskId);

    if (!result.success && !result.error) {
      return response.error(`Command failed\n${formatters.context(result)}\n\n${formatters.output(result)}`);
    }

    if (result.error) return response.error(`Error: ${result.error}`);

    return response.success(`${formatters.context(result)}\n\n${formatters.output(result)}`);
  } catch (error) {
    return response.error(`Error: ${error?.message || String(error)}`);
  }
};

export const executionTools = process.platform === 'win32'
  ? [{
      name: 'execute',
      description: 'Execute code (JS/TS, Deno, Go, Rust, Python, C, C++, Java)',
      inputSchema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Working directory' },
          code: { type: 'string', description: 'Code to execute' },
          language: { type: 'string', enum: ['nodejs', 'typescript', 'deno', 'go', 'rust', 'python', 'c', 'cpp', 'java', 'auto'], description: 'Language (default: auto)' },
          run_in_background: { type: 'boolean', description: 'Return immediately with task reference. Commands have a hard 15s ceiling then auto-background.' }
        },
        required: ['workingDirectory', 'code']
      },
      handler: createExecutionHandler(validate.execute)
    }]
  : [{
      name: 'execute',
      description: 'Execute code (JS/TS, Deno, Go, Rust, Python, C, C++, Java)',
      inputSchema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Working directory' },
          code: { type: 'string', description: 'Code to execute' },
          language: { type: 'string', enum: ['nodejs', 'typescript', 'deno', 'go', 'rust', 'python', 'c', 'cpp', 'java', 'auto'], description: 'Language (default: auto)' },
          run_in_background: { type: 'boolean', description: 'Return immediately with task reference. Commands have a hard 15s ceiling then auto-background.' }
        },
        required: ['workingDirectory', 'code']
      },
      handler: createExecutionHandler(validate.execute)
    }, {
      name: 'bash',
      description: 'Execute bash shell commands',
      inputSchema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Working directory' },
          commands: { type: ['string', 'array'], description: 'Commands to execute' },
          language: { type: 'string', enum: ['bash', 'sh', 'zsh'], description: 'Language (default: bash)' },
          run_in_background: { type: 'boolean', description: 'Return immediately with task reference. Commands have a hard 15s ceiling then auto-background.' }
        },
        required: ['workingDirectory', 'commands']
      },
      handler: createExecutionHandler(validate.bash, true)
    }];
