import { executeCode, validateExecuteParams, validateBashParams } from './execute-code.js';
import { getProcessStatus, closeProcess, activeProcesses } from './process-manager.js';
import { getRunningProcessesList, formatExecutionOutput, formatExecutionContext } from './formatters.js';

const BACKGROUND_THRESHOLD = 30000;

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
      const paramError = validateExecuteParams(code, workingDirectory);
      if (paramError) {
        return {
          content: [{ type: 'text', text: paramError.error + getRunningProcessesList() }],
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
         const currentOutput = (proc?.stdout || '') + (proc?.stderr ? `\n[STDERR]\n${proc.stderr}` : '');
         return {
           content: [{
             type: 'text',
             text: `Process backgrounded. ID: ${processId}\nResource: ${resourceUri}\nElapsed: ${BACKGROUND_THRESHOLD}ms\n\nCurrent output:\n${currentOutput || '(no output yet)'}` + getRunningProcessesList()
           }],
           isError: false
         };
       }

       if (!result.success) {
         const output = formatExecutionOutput(result);
         const context = formatExecutionContext(result);
         return {
           content: [{ type: 'text', text: `Command failed\n${context}\n\n${output}` + getRunningProcessesList() }],
           isError: true
         };
       }

       const output = formatExecutionOutput(result);
       const context = formatExecutionContext(result);
       return {
         content: [{ type: 'text', text: `${context}\n\n${output}` + getRunningProcessesList() }],
         isError: false
       };
    } catch (error) {
      activeProcesses.delete(processId);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` + getRunningProcessesList() }],
        isError: true
      };
    }
  }
};

const bashTool = {
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
      const paramError = validateBashParams(commands, workingDirectory);
      if (paramError) {
        return {
          content: [{ type: 'text', text: paramError.error + getRunningProcessesList() }],
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
         const currentOutput = (proc?.stdout || '') + (proc?.stderr ? `\n[STDERR]\n${proc.stderr}` : '');
         return {
           content: [{
             type: 'text',
             text: `Process backgrounded. ID: ${processId}\nResource: ${resourceUri}\nElapsed: ${BACKGROUND_THRESHOLD}ms\n\nCurrent output:\n${currentOutput || '(no output yet)'}` + getRunningProcessesList()
           }],
           isError: false
         };
       }

       if (!result.success) {
         const output = formatExecutionOutput(result);
         const context = formatExecutionContext(result);
         return {
           content: [{ type: 'text', text: `Command failed\n${context}\n\n${output}` + getRunningProcessesList() }],
           isError: true
         };
       }

       const output = formatExecutionOutput(result);
       const context = formatExecutionContext(result);
       return {
         content: [{ type: 'text', text: `${context}\n\n${output}` + getRunningProcessesList() }],
         isError: false
       };
    } catch (error) {
      activeProcesses.delete(processId);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` + getRunningProcessesList() }],
        isError: true
      };
    }
  }
};

export const executionTools = process.platform === 'win32' ? [baseExecuteTool] : [baseExecuteTool, bashTool];

export { getProcessStatus, closeProcess };
