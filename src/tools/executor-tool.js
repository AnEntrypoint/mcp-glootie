import { spawn, execSync } from 'child_process';
import { validateWorkingDirectory, createToolResponse } from '../core/utilities.js';
import { writeFileSync, chmodSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';
import { workingDirectoryContext, createToolContext } from '../core/working-directory-context.js';
import { suppressConsoleOutput } from '../core/console-suppression.js';



function getContextSummary(context) {
  if (!context || !context.sessionData) {
    return '';
  }

  const lines = [];
  lines.push(`📁 Context: ${context.workingDirectory}`);
  lines.push(`🔧 Tool: ${context.toolName}`);
  lines.push(`📊 Session: ${context.sessionData.totalToolCalls} tool calls`);

  if (context.previousUsage) {
    lines.push(`📈 Used ${context.previousUsage.count} times before`);
  }

  if (context.relevantFiles.length > 0) {
    lines.push(`📄 ${context.relevantFiles.length} relevant files available`);
  }

  if (context.insights.length > 0) {
    lines.push(`💡 ${context.insights.length} insights from previous tasks`);
  }

  lines.push(''); 

  return lines.join('\n') + '\n';
}

function createExecutionErrorResponse(error, startTime, context = {}) {
  return {
    success: false,
    error: error?.message || error || 'Unknown error occurred',
    executionTimeMs: Date.now() - startTime,
    ...context
  };
}


function generateExecutionInsights(result, query, workingDirectory) {
  const insights = [];

  
  if (result.success) {
    insights.push(`Execution successful: ${query}`);

    
    if (result.filesAccessed && result.filesAccessed.length > 0) {
      insights.push(`Modified ${result.filesAccessed.length} files: ${result.filesAccessed.slice(0, 3).join(', ')}${result.filesAccessed.length > 3 ? '...' : ''}`);
    }

    
    if (result.executionTimeMs) {
      if (result.executionTimeMs > 5000) {
        insights.push(`Slow execution (${result.executionTimeMs}ms) - consider optimization`);
      } else if (result.executionTimeMs < 100) {
        insights.push(`Fast execution (${result.executionTimeMs}ms)`);
      }
    }

    
    if (result.stdout && result.stdout.length > 0) {
      const lines = result.stdout.split('\n').length;
      insights.push(`Generated ${lines} lines of output`);
    }

    
    if (result.success && query.includes('test')) {
      insights.push('Consider running additional tests or checking test coverage');
    }

    if (result.success && (query.includes('install') || query.includes('build'))) {
      insights.push('Verify installation/build completed successfully');
    }

  } else {
    insights.push(`Execution failed: ${result.error || 'Unknown error'}`);

    
    if (result.error?.includes('ENOENT')) {
      insights.push('Command not found - check installation or PATH');
    } else if (result.error?.includes('EACCES')) {
      insights.push('Permission denied - check file permissions');
    } else if (result.error?.includes('timeout')) {
      insights.push('Operation timed out - consider increasing timeout or optimizing');
    }
  }

  
  if (workingDirectory !== process.cwd()) {
    insights.push(`Executed in: ${workingDirectory}`);
  }

  return insights;
}

function createSuccessResponse(data, startTime, context = {}) {
  return {
    success: true,
    executionTimeMs: Date.now() - startTime,
    ...data,
    ...context
  };
}

function createTimeoutError(operation, timeoutMs, startTime) {
  return createExecutionErrorResponse(
    `${operation} timed out after ${timeoutMs}ms`,
    startTime,
    { timeout: true, timeoutMs }
  );
}

function handleProcessError(error, command, startTime) {
  let errorMessage = 'Process execution failed';
  let errorContext = { command };

  if (error.code === 'ENOENT') {
    errorMessage = `Command not found: ${command}`;
    errorContext.missingCommand = true;
  } else if (error.code === 'EACCES') {
    errorMessage = `Permission denied executing: ${command}`;
    errorContext.permissionDenied = true;
  } else if (error.signal) {
    errorMessage = `Process terminated with signal: ${error.signal}`;
    errorContext.signal = error.signal;
  } else if (error.code) {
    errorMessage = `Process failed with code: ${error.code}`;
    errorContext.exitCode = error.code;
  }

  return createExecutionErrorResponse(errorMessage, startTime, errorContext);
}

function validateRequiredParams(params, required, startTime) {
  for (const param of required) {
    if (!params[param]) {
      return createExecutionErrorResponse(
        `Parameter '${param}' is required`,
        startTime,
        { parameterError: true, parameter: param }
      );
    }
  }
  return null;
}

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
          resolve(createExecutionErrorResponse(
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

const EXECUTION_CONFIGS = {
  nodejs: { command: 'node', args: ['-e'], description: 'Node.js JavaScript' },
  deno: { command: 'deno', args: ['eval', '--no-check'], description: 'Deno JavaScript/TypeScript' },
  bash: { command: 'bash', args: ['-c'], description: 'Bash shell commands' },
  go: { command: 'go', args: ['run'], description: 'Go programming language', requiresFile: true },
  rust: { command: 'rustc', args: [], description: 'Rust programming language', requiresCompile: true },
  python: { command: 'python3', args: ['-c'], description: 'Python programming language' },
  c: { command: 'gcc', args: [], description: 'C programming language', requiresCompile: true },
  cpp: { command: 'g++', args: [], description: 'C++ programming language', requiresCompile: true }
};

export async function executeWithRuntime(codeOrCommands, runtime, options = {}) {
  const { workingDirectory, timeout = 120000 } = options;
  const config = EXECUTION_CONFIGS[runtime];

  if (!config) {
    throw new Error(`Unsupported runtime: ${runtime}`);
  }

  
  if (runtime === 'bash') {
    
    if (Array.isArray(codeOrCommands)) {
      const script = createBashScript(codeOrCommands);
      const tempScript = path.join(os.tmpdir(), `glootie_bash_${Date.now()}.sh`);
      writeFileSync(tempScript, script);
      chmodSync(tempScript, '755');

      
      return executeProcess(config.command, [tempScript], {
        cwd: workingDirectory,
        timeout,
        encoding: 'utf8'
      }).finally(() => {
        try { unlinkSync(tempScript); } catch (e) {
          
        }
      });
    } else {
      
      return executeProcess(config.command, [...config.args, codeOrCommands], {
        cwd: workingDirectory,
        timeout,
        encoding: 'utf8'
      });
    }
  }

  if (config.requiresFile) {
    
    const tempFile = path.join(os.tmpdir(), `glootie_${runtime}_${Date.now()}.${runtime === 'go' ? 'go' : 'rs'}`);
    try {
      writeFileSync(tempFile, codeOrCommands);
      return executeProcess(config.command, [...config.args, tempFile], {
        cwd: workingDirectory,
        timeout,
        encoding: 'utf8'
      });
    } finally {
      try { unlinkSync(tempFile); } catch (e) {}
    }
  }

  if (config.requiresCompile) {
    
    const extensions = { rust: 'rs', c: 'c', cpp: 'cpp' };
    const compilers = { rust: 'rustc', c: 'gcc', cpp: 'g++' };

    const tempFile = path.join(os.tmpdir(), `glootie_${runtime}_${Date.now()}.${extensions[runtime]}`);
    const tempExec = path.join(os.tmpdir(), `glootie_${runtime}_${Date.now()}`);

    try {
      writeFileSync(tempFile, codeOrCommands);

      
      const compileResult = await executeProcess(compilers[runtime], [tempFile, '-o', tempExec], {
        cwd: workingDirectory,
        timeout: timeout / 2,
        encoding: 'utf8'
      });

      if (!compileResult.success) {
        return compileResult;
      }

      
      return await executeProcess(tempExec, [], {
        cwd: workingDirectory,
        timeout: timeout / 2,
        encoding: 'utf8'
      });
    } finally {
      try { unlinkSync(tempFile); } catch (e) {}
      try { unlinkSync(tempExec); } catch (e) {}
    }
  }

  
  return executeProcess(config.command, [...config.args, codeOrCommands], {
    cwd: workingDirectory,
    timeout,
    encoding: 'utf8'
  });
}

export async function executeBashCommands(commands, options = {}) {
  return executeWithRuntime(commands, 'bash', options);
}

export async function executeNodeCode(code, options = {}) {
  return executeWithRuntime(code, 'nodejs', options);
}

export async function executeDenoCode(code, options = {}) {
  return executeWithRuntime(code, 'deno', options);
}

export async function executeBashCommand(commands, timeout = 120000, workingDirectory, defaultWorkingDir) {
  const startTime = Date.now();

  const paramError = validateRequiredParams({ workingDirectory }, ['workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(workingDirectory);
  if (!dirValidation.isValid) {
    return createExecutionErrorResponse(dirValidation.error, startTime);
  }

  const effectiveWorkingDir = dirValidation.resolvedDir;

  const commandArray = Array.isArray(commands) ? commands : [commands];

  
  const nonEmptyCommands = commandArray.filter(cmd => {
    if (typeof cmd !== 'string') return false;
    const trimmed = cmd.trim();
    
    return trimmed.length > 0 && !trimmed.startsWith('#');
  });

  if (nonEmptyCommands.length === 0) {
    return createExecutionErrorResponse("No valid commands to execute", startTime);
  }

  const validationResult = validateExecutionContent(nonEmptyCommands, 'Commands');
  if (!validationResult.valid) {
    return createExecutionErrorResponse(validationResult.error, startTime);
  }

  
  const securityValidation = validateBashCommands(nonEmptyCommands);
  if (!securityValidation.valid) {
    return createExecutionErrorResponse(securityValidation.error, startTime);
  }

  
  const result = await executeBashCommands(nonEmptyCommands, {
    workingDirectory: dirValidation.effectiveDir,
    timeout
  });

  return result;
}

export function validateBashCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return {
      valid: false,
      error: "Commands must be a non-empty array"
    };
  }

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];

    if (typeof command !== 'string') {
      return {
        valid: false,
        error: `Command ${i}: Must be a string`
      };
    }

    if (command.trim().length === 0) {
      return {
        valid: false,
        error: `Command ${i}: Cannot be empty or whitespace only`
      };
    }

    const dangerous = ['rm -rf /', 'sudo rm', 'format', 'mkfs', ':(){ :|:& };:', 'dd if=/dev/zero'];
    const lowerCommand = command.toLowerCase();

    for (const pattern of dangerous) {
      if (lowerCommand.includes(pattern)) {
        return {
          valid: false,
          error: `Command ${i}: Contains potentially dangerous pattern '${pattern}'`
        };
      }
    }
  }

  return { valid: true };
}

function createBashScript(commands) {
  const scriptLines = [
    '#!/bin/bash',
    'set -e',
    'set -o pipefail',
    '',
    'echo "=== BASH EXECUTION START ==="',
    `echo "Commands to execute: ${commands.length}"`,
    'echo "Working directory: $(pwd)"',
    'echo "Timestamp: $(date)"',
    'echo ""'
  ];

  commands.forEach((command, index) => {
    scriptLines.push(`echo "--- Command ${index + 1}/${commands.length} ---"`);
    scriptLines.push(`echo "$ ${command}"`);
    scriptLines.push(command);
    scriptLines.push('CMD_EXIT_CODE=$?');
    scriptLines.push('if [ $CMD_EXIT_CODE -ne 0 ]; then');
    scriptLines.push(`  echo "Command ${index + 1} failed with exit code $CMD_EXIT_CODE" >&2`);
    scriptLines.push('  exit $CMD_EXIT_CODE');
    scriptLines.push('fi');
    scriptLines.push('echo ""');
  });

  scriptLines.push('echo "=== BASH EXECUTION COMPLETE ==="');
  scriptLines.push('echo "All commands completed"');

  return scriptLines.join('\n');
}


function validateRequiredParamsUtil(params, requiredParams) {
  const missingParams = requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }
}

function validateExecutionContent(content, type) {
  if (!content || (typeof content !== 'string' && !Array.isArray(content))) {
    return { valid: false, error: `${type} must be a non-empty string or array` };
  }

  if (typeof content === 'string' && content.trim().length === 0) {
    return { valid: false, error: `${type} cannot be empty or whitespace only` };
  }

  if (Array.isArray(content) && content.length === 0) {
    return { valid: false, error: `${type} array cannot be empty` };
  }

  if (Array.isArray(content)) {
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      if (typeof item !== 'string') {
        return { valid: false, error: `${type} array item ${i} must be a string` };
      }
      if (item.trim().length === 0) {
        return { valid: false, error: `${type} array item ${i} cannot be empty` };
      }
    }
  }

  return { valid: true };
}


let runtimeCache = null;

export function detectAvailableRuntimes() {
  if (runtimeCache) return runtimeCache;

  const runtimes = {
    nodejs: { cmd: 'node --version', available: false, version: null },
    deno: { cmd: 'deno --version', available: false, version: null },
    bash: { cmd: 'bash --version', available: false, version: null },
    go: { cmd: 'go version', available: false, version: null },
    rust: { cmd: 'rustc --version', available: false, version: null },
    python: { cmd: 'python3 --version', available: false, version: null },
    c: { cmd: 'gcc --version', available: false, version: null },
    cpp: { cmd: 'g++ --version', available: false, version: null }
  };

  for (const [name, config] of Object.entries(runtimes)) {
    try {
      const result = execSync(config.cmd, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      config.available = true;
      config.version = result.split('\n')[0].trim();
    } catch (error) {
      config.available = false;
    }
  }

  runtimeCache = runtimes;
  return runtimes;
}

export async function executeWithRuntimeValidation(codeOrCommands, runtime, options = {}) {
  const startTime = Date.now();
  const { workingDirectory, timeout = 120000 } = options;

  
  const runtimes = detectAvailableRuntimes();
  const runtimeInfo = runtimes[runtime];

  if (!runtimeInfo || !runtimeInfo.available) {
    const config = EXECUTION_CONFIGS[runtime];
    const errorMessage = `${config.description} runtime not available. Install ${config.command} to use this feature.`;
    return createExecutionErrorResponse(errorMessage, startTime);
  }

  return executeWithRuntime(codeOrCommands, runtime, options);
}

export async function executeGoCode(code, options = {}) {
  return executeWithRuntimeValidation(code, 'go', options);
}

export async function executePythonCode(code, options = {}) {
  return executeWithRuntimeValidation(code, 'python', options);
}

export async function executeRustCode(code, options = {}) {
  return executeWithRuntimeValidation(code, 'rust', options);
}

export async function executeCCode(code, options = {}) {
  return executeWithRuntimeValidation(code, 'c', options);
}

export async function executeCppCode(code, options = {}) {
  return executeWithRuntimeValidation(code, 'cpp', options);
}

export { generateExecutionInsights };

export const executionTools = [
  {
    name: "execute",
    description: "TEST CODE IDEAS BEFORE IMPLEMENTING THEM - Execute code snippets in any languages (JS/TS, Go, Rust, Python, C, C++) with automatic runtime detection. test your hypotheses in code before implmenting, validating your approaches, prototype functions, debug issues. Use this to analyse all important 'what if' scenarios before editing files.",
    inputSchema: {
      type: "object",
      properties: {
        workingDirectory: {
          type: "string",
          description: "REQUIRED: Absolute path to working directory for execution."
        },
        code: {
          type: "string",
          description: "code to execute"
        },
        commands: {
          type: ["string", "array"],
          description: "Bash commands (single or array for planned batch executions)"
        },
        runtime: {
          type: "string",
          enum: ["nodejs", "deno", "bash", "go", "rust", "python", "c", "cpp", "auto"],
          description: "Execution runtime (default: auto-detect)"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 120000)"
        }
      },
      required: ["workingDirectory"]
    },
    handler: async ({ code, commands, workingDirectory, runtime = "auto", timeout = 120000 }) => {
      
      const consoleRestore = suppressConsoleOutput();
      const effectiveWorkingDirectory = workingDirectory || process.cwd();
      const query = code || commands || '';

      try {
        let result;
        if (code) {
          const targetRuntime = runtime === "auto" ? "nodejs" : runtime;
          result = await executeWithRuntimeValidation(code, targetRuntime, { workingDirectory, timeout });
          result = enhanceExecutionResult(result, code, targetRuntime, workingDirectory);
        } else if (commands) {
          result = await executeWithRuntimeValidation(commands, 'bash', { workingDirectory, timeout });
          result = enhanceExecutionResult(result, commands, 'bash', workingDirectory);
        } else {
          result = { content: [{ type: "text", text: "No code or commands provided" }] };
        }

        
        const insights = generateExecutionInsights(result, query, effectiveWorkingDirectory);

        
        const toolContext = createToolContext('execute', effectiveWorkingDirectory, query, {
          ...result,
          duration: result.executionTimeMs || 0,
          filesAccessed: result.filesAccessed || [],
          patterns: result.patterns || [],
          insights: insights
        });

        
        await workingDirectoryContext.updateContext(effectiveWorkingDirectory, 'execute', toolContext);

        return result;
      } catch (error) {
        
        const errorContext = createToolContext('execute', effectiveWorkingDirectory, query, {
          error: error.message,
          duration: 0
        });
        await workingDirectoryContext.updateContext(effectiveWorkingDirectory, 'execute', errorContext);
        throw error;
      } finally {
        
        consoleRestore.restore();
      }
    }
  }
];

function enhanceExecutionResult(result, code, runtime, workingDirectory) {
  
  if (result.content) {
    return result;
  }

  
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const hasError = !result.success || stderr.includes('Error') || stderr.includes('error') || stderr.includes('SyntaxError');

  let enhancedContent = '';

  if (result.success) {
    enhancedContent += `✅ Execution successful (${result.executionTimeMs}ms)\n\n`;
    if (stdout) {
      enhancedContent += `📋 Output:\n${stdout}\n`;
    }
    if (stderr && !stderr.includes('Error') && !stderr.includes('error')) {
      enhancedContent += `⚠️ Warnings:\n${stderr}\n`;
    }
  } else {
    enhancedContent += `❌ Execution failed (${result.executionTimeMs}ms)\n\n`;
    enhancedContent += `🔍 Error Analysis:\n`;
    enhancedContent += `• Error: ${result.error}\n`;
    if (stderr) {
      enhancedContent += `• Details: ${stderr}\n`;
    }
    enhancedContent += `\n💡 Troubleshooting Steps:\n`;

    
    if (runtime === 'nodejs' || runtime === 'javascript') {
      enhancedContent += generateJavaScriptTroubleshooting(code, stderr);
    } else if (runtime === 'python') {
      enhancedContent += generatePythonTroubleshooting(code, stderr);
    } else if (runtime === 'bash') {
      enhancedContent += generateBashTroubleshooting(code, stderr);
    } else {
      enhancedContent += generateGenericTroubleshooting(code, stderr);
    }
  }

  
  enhancedContent += `\n📊 Execution Summary:\n`;
  enhancedContent += `• Runtime: ${runtime}\n`;
  enhancedContent += `• Duration: ${result.executionTimeMs}ms\n`;

  return {
    content: [{ type: "text", text: enhancedContent }],
    isError: hasError
  };
}

function generateJavaScriptTroubleshooting(code, stderr) {
  return stderr;
}

function generatePythonTroubleshooting(code, stderr) {
  return stderr;
}

function generateBashTroubleshooting(code, stderr) {
  return stderr;
}

function generateGenericTroubleshooting(code, stderr) {
  return stderr;
}