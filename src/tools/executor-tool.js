import { executeCode, validate } from './execute-code.js';
import { getProcessStatus, closeProcess, activeProcesses } from './process-manager.js';

const BACKGROUND_THRESHOLD = 30000;

const formatters = {
  processList() {
    if (activeProcesses.size === 0) return '';
    const list = Array.from(activeProcesses.entries())
      .map(([pid, proc]) => `  - ${pid} (${Date.now() - proc.startTime}ms elapsed)`)
      .join('\n');
    return `\nRunning processes:\n${list}`;
  },
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
  success(text, withProcesses = false) {
    return {
      content: [{ type: 'text', text: text + (withProcesses ? formatters.processList() : '') }],
      isError: false
    };
  },
  error(text, withProcesses = false) {
    return {
      content: [{ type: 'text', text: text + (withProcesses ? formatters.processList() : '') }],
      isError: true
    };
  }
};

const createExecutionHandler = (validateFn, isBash = false) => async (args) => {
  const { code, commands, workingDirectory, language = isBash ? 'bash' : 'auto' } = args;
  const processId = `proc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    const params = isBash ? { commands, workingDirectory } : { code, workingDirectory };
    const err = validate[isBash ? 'bash' : 'execute'](params);
    if (err) return response.error(err, true);

    const cmd = isBash ? (Array.isArray(commands) ? commands.join(' && ') : String(commands)) : code;
    const runtime = !isBash && language === 'typescript' ? 'nodejs' : (language || 'nodejs');

    const result = await Promise.race([
      executeCode(cmd, runtime, workingDirectory, processId),
      new Promise(resolve => setTimeout(() => resolve(null), BACKGROUND_THRESHOLD))
    ]);

    if (!result) {
      const proc = activeProcesses.get(processId);
      const resourceUri = `glootie://process/${processId}`;
      const output = (proc?.stdout || '') + (proc?.stderr ? `\n[STDERR]\n${proc.stderr}` : '');
      return response.success(
        `Process backgrounded. ID: ${processId}\nResource: ${resourceUri}\nElapsed: ${BACKGROUND_THRESHOLD}ms\n\nCurrent output:\n${output || '(no output yet)'}`,
        true
      );
    }

    if (!result.success) {
      const msg = `${formatters.context(result)}\n\n${formatters.output(result)}`;
      return response.error(`Command failed\n${msg}`, true);
    }

    const msg = `${formatters.context(result)}\n\n${formatters.output(result)}`;
    return response.success(msg, true);
  } catch (error) {
    activeProcesses.delete(processId);
    return response.error(`Error: ${error?.message || String(error)}`, true);
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

export { getProcessStatus, closeProcess };
