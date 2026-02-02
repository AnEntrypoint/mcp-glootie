import { executeCode, validate } from './execute-code-isolated.js';

const BACKGROUND_THRESHOLD = 30000;

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
  success(text) {
    return {
      content: [{ type: 'text', text }],
      isError: false
    };
  },
  error(text) {
    return {
      content: [{ type: 'text', text }],
      isError: true
    };
  }
};

const createExecutionHandler = (validateFn, isBash = false) => async (args) => {
  const { code, commands, workingDirectory, language = isBash ? 'bash' : 'auto' } = args;

  try {
    const params = isBash ? { commands, workingDirectory } : { code, workingDirectory };
    const err = validate[isBash ? 'bash' : 'execute'](params);
    if (err) return response.error(err);

    const cmd = isBash ? (Array.isArray(commands) ? commands.join(' && ') : String(commands)) : code;
    let runtime = language || 'nodejs';
    if (!isBash && (runtime === 'typescript' || runtime === 'auto')) {
      runtime = 'nodejs';
    }

    const result = await Promise.race([
      executeCode(cmd, runtime, workingDirectory, BACKGROUND_THRESHOLD),
      new Promise(resolve => setTimeout(() => resolve(null), BACKGROUND_THRESHOLD))
    ]);

    if (!result) {
      return response.success(
        `Process backgrounded after ${BACKGROUND_THRESHOLD}ms. Execution continues in worker pool.`
      );
    }

    if (!result.success && !result.error) {
      const msg = `${formatters.context(result)}\n\n${formatters.output(result)}`;
      return response.error(`Command failed\n${msg}`);
    }

    if (result.error) {
      return response.error(`Error: ${result.error}`);
    }

    const msg = `${formatters.context(result)}\n\n${formatters.output(result)}`;
    return response.success(msg);
  } catch (error) {
    return response.error(`Error: ${error?.message || String(error)}`);
  }
};

export const executionTools = process.platform === 'win32'
  ? [{
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
      handler: createExecutionHandler(validate.execute)
    }]
  : [{
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
      handler: createExecutionHandler(validate.execute)
    }, {
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
      handler: createExecutionHandler(validate.bash, true)
    }];
