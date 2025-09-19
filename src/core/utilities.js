import * as path from 'node:path';
import { existsSync, statSync } from 'fs';
import { fileURLToPath } from 'node:url';

// Get current directory for absolute imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createErrorResponse(error, startTime, context = {}) {
  return {
    success: false,
    error: error?.message || error || 'Unknown error occurred',
    executionTimeMs: Date.now() - startTime,
    ...context
  };
}

function createSuccessResponse(data, startTime, context = {}) {
  return {
    success: true,
    executionTimeMs: Date.now() - startTime,
    ...data,
    ...context
  };
}

function validateRequiredParams(args, requiredParams, startTime) {
  const missingParams = requiredParams.filter(param => !args[param]);
  if (missingParams.length > 0) {
    return createErrorResponse(
      new Error(`Missing required parameters: ${missingParams.join(', ')}`),
      startTime
    );
  }
  return null;
}

export const validateWorkingDirectory = (workingDirectory, defaultWorkingDir) => {
  if (!workingDirectory) {
    return {
      valid: false,
      error: 'REQUIRED PARAMETER MISSING: workingDirectory is mandatory for all tool operations. Please provide a valid directory path.',
      effectiveDir: null
    };
  }

  try {
    const resolvedPath = path.resolve(workingDirectory);

    if (!existsSync(resolvedPath)) {
      return {
        valid: false,
        error: `DIRECTORY NOT FOUND: Working directory '${workingDirectory}' does not exist. Please provide an existing directory path.`,
        effectiveDir: null
      };
    }

    const stats = statSync(resolvedPath);

    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: `INVALID PATH TYPE: '${workingDirectory}' exists but is not a directory. Please provide a valid directory path.`,
        effectiveDir: null
      };
    }

    return { valid: true, effectiveDir: resolvedPath };
  } catch (error) {
    return {
      valid: false,
      error: `Working directory '${workingDirectory}' is not accessible: ${error.message}`,
      effectiveDir: null
    };
  }
};

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function createToolResponse(content, isError = false) {
  return {
    content: [{ type: "text", text: content }],
    isError
  };
}

export function createErrorResponseUtil(message) {
  return createToolResponse(`Error: ${message}`, true);
}

// Error types classification
const ErrorTypes = {
  PERMISSION_DENIED: 'permission_denied',
  UNSUPPORTED_OPERATION: 'unsupported_operation',
  VALIDATION_ERROR: 'validation_error',
  FILE_NOT_FOUND: 'file_not_found',
  TIMEOUT: 'timeout',
  SYNTAX_ERROR: 'syntax_error',
  NETWORK_ERROR: 'network_error',
  UNKNOWN: 'unknown'
};

// Tool error classification
function classifyError(error, operationType = null) {
  const message = error?.message || error || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized') || lowerMessage.includes('access denied')) {
    return { type: ErrorTypes.PERMISSION_DENIED, originalError: error };
  }

  if (lowerMessage.includes('unsupported') || lowerMessage.includes('not supported') ||
      (operationType && lowerMessage.includes(operationType) && lowerMessage.includes('not found'))) {
    return { type: ErrorTypes.UNSUPPORTED_OPERATION, originalError: error };
  }

  if (lowerMessage.includes('validation') || lowerMessage.includes('required') || lowerMessage.includes('missing')) {
    return { type: ErrorTypes.VALIDATION_ERROR, originalError: error };
  }

  if (lowerMessage.includes('file not found') || lowerMessage.includes('no such file') || lowerMessage.includes('ENOENT')) {
    return { type: ErrorTypes.FILE_NOT_FOUND, originalError: error };
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return { type: ErrorTypes.TIMEOUT, originalError: error };
  }

  if (lowerMessage.includes('syntax') || lowerMessage.includes('parse error')) {
    return { type: ErrorTypes.SYNTAX_ERROR, originalError: error };
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('fetch')) {
    return { type: ErrorTypes.NETWORK_ERROR, originalError: error };
  }

  return { type: ErrorTypes.UNKNOWN, originalError: error };
}

// Alternative tool suggestions
function getAlternativeTools(operationType) {
  const alternatives = {
    'execute': ['Try splitting into smaller code chunks', 'Use bash runtime instead of nodejs', 'Check syntax before execution'],
    'searchcode': ['Use grep or Glob for simple searches', 'Try more specific search terms', 'Search in specific directories'],
    'parse_ast': ['Check code syntax first', 'Ensure file exists and is readable', 'Try with smaller code samples'],
    'astgrep_search': ['Use simpler search patterns', 'Try string-based search first', 'Check AST pattern syntax'],
    'astgrep_replace': ['Verify pattern matches first with astgrep_search', 'Test replacement on small sample', 'Check file permissions'],
    'astgrep_lint': ['Run individual checks instead of batch', 'Check ignore patterns', 'Verify working directory'],
    'retrieve_overflow': ['Try without pagination cursor', 'List available files first', 'Check content ID format'],
    'batch_execute': ['Execute operations individually', 'Reduce batch size', 'Check operation types are supported']
  };

  return alternatives[operationType] || ['Try standard tools instead', 'Break down into smaller tasks', 'Check tool documentation'];
}

// Recovery action suggestions
function getRecoveryAction(errorInfo, operationType = null) {
  const { type, originalError } = errorInfo;

  switch (type) {
    case ErrorTypes.PERMISSION_DENIED:
      return {
        action: 'fallback_to_standard',
        message: 'Permission denied. Consider using standard tools or checking access rights.',
        alternatives: ['Use standard Read/Edit/Grep tools', 'Check file permissions', 'Run with elevated privileges if needed']
      };

    case ErrorTypes.UNSUPPORTED_OPERATION:
      return {
        action: 'suggest_alternative',
        message: `Operation '${operationType}' is not supported in this context.`,
        alternatives: getAlternativeTools(operationType)
      };

    case ErrorTypes.VALIDATION_ERROR:
      return {
        action: 'fix_parameters',
        message: 'Invalid parameters provided.',
        alternatives: ['Check required parameters', 'Verify parameter formats', 'Review tool documentation']
      };

    case ErrorTypes.FILE_NOT_FOUND:
      return {
        action: 'check_path',
        message: 'File or directory not found.',
        alternatives: ['Verify file paths exist', 'Check working directory', 'Use absolute paths']
      };

    case ErrorTypes.TIMEOUT:
      return {
        action: 'retry_or_optimize',
        message: 'Operation timed out.',
        alternatives: ['Increase timeout value', 'Optimize operation complexity', 'Break into smaller operations']
      };

    case ErrorTypes.SYNTAX_ERROR:
      return {
        action: 'fix_syntax',
        message: 'Syntax error in code or patterns.',
        alternatives: ['Validate code syntax', 'Check AST pattern syntax', 'Use simpler expressions']
      };

    case ErrorTypes.NETWORK_ERROR:
      return {
        action: 'retry_or_offline',
        message: 'Network or connection error.',
        alternatives: ['Check internet connection', 'Retry operation', 'Use offline alternatives if available']
      };

    default:
      return {
        action: 'general_troubleshooting',
        message: 'An unexpected error occurred.',
        alternatives: ['Check tool documentation', 'Try alternative approach', 'Break down into simpler steps']
      };
  }
}

// Enhanced error response with recovery suggestions
export function createEnhancedErrorResponse(error, operationType = null, context = {}) {
  const errorInfo = classifyError(error, operationType);
  const recovery = getRecoveryAction(errorInfo, operationType);

  const errorMessage = error?.message || error || 'Unknown error';

  let responseText = `❌ Error: ${errorMessage}\n\n`;
  responseText += `🔍 Error Type: ${errorInfo.type}\n`;
  responseText += `💡 Recovery Suggestion: ${recovery.message}\n\n`;
  responseText += `🛠️  Suggested Actions:\n`;
  recovery.alternatives.forEach((alt, index) => {
    responseText += `${index + 1}. ${alt}\n`;
  });

  if (context.operation) {
    responseText += `\n📝 Operation: ${context.operation}\n`;
  }
  if (context.workingDirectory) {
    responseText += `📁 Working Directory: ${context.workingDirectory}\n`;
  }

  return createToolResponse(responseText, true);
}

// Wrap tool handlers with enhanced error recovery
export function createRecoveryToolHandler(handler, toolName, timeoutMs = 30000) {
  return async (args) => {
    const startTime = Date.now();

    try {
      const result = await handler(args);
      return result;
    } catch (error) {
      console.error(`[Error Recovery] Tool '${toolName}' failed:`, error.message);

      // Extract operation type from args if available
      const operationType = args?.type || args?.operation || toolName;

      // Create enhanced error response with recovery suggestions
      return createEnhancedErrorResponse(
        error,
        operationType,
        {
          operation: operationType,
          workingDirectory: args?.workingDirectory,
          executionTimeMs: Date.now() - startTime
        }
      );
    }
  };
}

export function createSuccessResponseUtil(data) {
  return createToolResponse(JSON.stringify(data, null, 2));
}

export function validateRequiredParamsUtil(params, requiredParams) {
  const missingParams = requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }
}

export function getDefaultIgnorePatterns(workingDirectory) {
  const defaultPatterns = {
    files: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/.git/**',
      '**/.vscode/**',
      '**/.idea/**',
      '**/*.log',
      '**/*.tmp',
      '**/temp/**',
      '**/tmp/**',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.map',
      '**/*.min.js',
      '**/*.min.css',
      '**/package-lock.json',
      '**/yarn.lock'
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md'],
    directories: [
      'node_modules',
      '.next',
      'dist',
      'build',
      'out',
      'coverage',
      '.nyc_output',
      '.git',
      '.vscode',
      '.idea',
      'temp',
      'tmp'
    ]
  };

  try {
    const fs = require('fs');
    const path = require('path');

    const searchDefaultsPath = path.join(workingDirectory, '.search-defaults.json');
    if (fs.existsSync(searchDefaultsPath)) {
      const customDefaults = JSON.parse(fs.readFileSync(searchDefaultsPath, 'utf8'));
      return { ...defaultPatterns, ...customDefaults };
    }

    const gitignorePath = path.join(workingDirectory, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      const gitignorePatterns = gitignoreContent
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.trim());

      return {
        ...defaultPatterns,
        customGitignore: gitignorePatterns
      };
    }
  } catch (error) {
    console.warn('Warning: Could not read ignore patterns, using defaults:', error.message);
  }

  return defaultPatterns;
}

export function formatSearchResults(results, query, path) {
  if (results.length === 0) {
    return `No results found for "${query}" in ${path}`;
  }

  return `Found ${results.length} results for "${query}" in ${path}:\n\n${results.map(r => `${r.file}:${r.startLine}-${r.endLine}\n${r.content.substring(0, 200)}...\nScore: ${r.score.toFixed(3)}`).join('\n\n')}`;
}

export function formatExecutionMessage(workingDirectory, runtime = 'auto') {
  return `Execution requested in ${workingDirectory} with runtime ${runtime}`;
}

export function formatBatchOperationMessage(operations) {
  return `Batch executing ${operations.length} operations`;
}

export function formatBatchSummary(operations, successfulOps) {
  const summaryLines = [];
  summaryLines.push(`Completed: ${successfulOps}/${operations.length} operations`);

  if (successfulOps === operations.length) {
    summaryLines.push('Status: All operations completed');
  } else {
    summaryLines.push('Status: Some operations encountered issues');
  }

  summaryLines.push('The system automatically selected and configured the appropriate tools based on your task description.');

  return summaryLines.join('\n');
}

export function getDefaultValues() {
  return {
    runtime: 'auto',
    timeout: 120000,
    path: '.',
    language: 'javascript',
    chunkIndex: 0,
    listFiles: false,
    cleanup: false
  };
}

export async function executeOperation(operation, errorMessage = "Operation failed") {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}

const MAX_TOKENS = 4000;
const CHARS_PER_TOKEN = 4;
const TRUNCATION_BUFFER = 100;
const MIN_PARTIAL_CHARS = 50;

function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function truncateContent(content, maxTokens = MAX_TOKENS) {
  if (!content || typeof content !== 'object') return content;

  const maxChars = maxTokens * CHARS_PER_TOKEN - TRUNCATION_BUFFER;

  if (Array.isArray(content)) return truncateArray(content, maxChars);
  if (content.text) return truncateSingle(content, maxChars);
  if (content.content?.length) return { ...content, content: truncateArray(content.content, maxChars) };

  return content;
}

function truncateArray(items, maxChars) {
  let totalChars = 0;
  const result = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.text) { result.push(item); continue; }

    const itemChars = item.text.length;
    if (totalChars + itemChars > maxChars) {
      const remaining = maxChars - totalChars;
      if (remaining > MIN_PARTIAL_CHARS) {
        result.push({ ...item, text: item.text.substring(0, remaining) + '\n\n[PARTIAL: Truncated]' });
      }

      const omitted = items.length - i - (remaining > MIN_PARTIAL_CHARS ? 0 : 1);
      if (omitted > 0) {
        const tokens = estimateRemainingTokens(items.slice(i + (remaining > MIN_PARTIAL_CHARS ? 1 : 0)));
        result.push({
          type: 'text',
          text: `\n[OUTPUT TRUNCATED: ${omitted} items omitted, ~${tokens} tokens, limit: ${MAX_TOKENS}]`
        });
      }
      break;
    }

    totalChars += itemChars;
    result.push(item);
  }
  return result;
}

function truncateSingle(content, maxChars) {
  if (content.text.length <= maxChars) return content;

  const truncated = content.text.substring(0, maxChars);
  const removed = content.text.length - maxChars;
  const tokens = estimateTokens(content.text.substring(maxChars));

  return {
    ...content,
    text: truncated + `\n\n[OUTPUT TRUNCATED: ${removed} chars, ~${tokens} tokens, limit: ${MAX_TOKENS}]`
  };
}

function estimateRemainingTokens(items) {
  const totalChars = items.reduce((sum, item) => sum + (item?.text?.length || 0), 0);
  return estimateTokens(totalChars.toString());
}

class PaginationManager {
  constructor() {
    this.cursors = new Map();
    this.pageSize = 50;
  }

  createCursor(data, position = 0) {
    const cursorId = generateId();
    this.cursors.set(cursorId, {
      data,
      position,
      timestamp: Date.now()
    });
    return cursorId;
  }

  getCursor(cursorId) {
    const cursor = this.cursors.get(cursorId);
    if (!cursor) {
      throw new Error('Invalid or expired cursor');
    }
    return cursor;
  }

  removeCursor(cursorId) {
    this.cursors.delete(cursorId);
  }

  cleanup() {
    const now = Date.now();
    const expiredTime = now - (30 * 60 * 1000);

    for (const [cursorId, cursor] of this.cursors.entries()) {
      if (cursor.timestamp < expiredTime) {
        this.cursors.delete(cursorId);
      }
    }
  }
}

const paginationManager = new PaginationManager();

export function createPaginatedResponse(items, cursor = null, hasNext = false) {
  const response = {
    items: items.slice(0, paginationManager.pageSize),
    hasNext
  };

  if (hasNext) {
    const remainingItems = items.slice(paginationManager.pageSize);
    response.nextCursor = paginationManager.createCursor(remainingItems, paginationManager.pageSize);
  }

  return response;
}

export function getPaginatedItems(items, cursor = null) {
  paginationManager.cleanup();

  if (!cursor) {
    return createPaginatedResponse(items);
  }

  try {
    const cursorData = paginationManager.getCursor(cursor);
    const remainingItems = cursorData.data;
    const response = createPaginatedResponse(remainingItems);

    if (!response.hasNext) {
      paginationManager.removeCursor(cursor);
    }

    return response;
  } catch (error) {
    throw new Error('Invalid cursor');
  }
}

export async function handlePaginatedList(args, dataFetcher, defaultWorkingDir) {
  const startTime = Date.now();

  const paramError = validateRequiredParams(args, ['workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }

  try {
    const data = await dataFetcher(args.workingDirectory, args);
    const result = getPaginatedItems(data, args.cursor);

    return createSuccessResponse(result, startTime);
  } catch (error) {
    return createErrorResponse(error, startTime, {
      operation: 'paginated_list',
      workingDirectory: args.workingDirectory
    });
  }
}

export function createTimeoutToolHandler(handler, toolName = 'Unknown Tool', timeoutMs = 30000) {
  return async (args) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([
        handler(args),
        timeoutPromise
      ]);
    } catch (error) {
      if (error.message.includes('timed out')) {
        return createErrorResponse(`Tool ${toolName} timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
  };
}

async function executeBatchOperation(operation, workingDirectory) {
  console.log('DEBUG: executeBatchOperation called with type:', operation.type);
  console.log('DEBUG: __dirname:', __dirname);
  try {
    console.log('DEBUG: About to enter switch statement');
    switch (operation.type) {
      case 'execute': {
        const { code, runtime = 'auto', timeout = 120000, commands } = operation;
        // Import and call execution functions
        const executorModule = await import('./unified-executor.js');

        if (runtime === 'bash' || (commands && (runtime === 'auto' || !code))) {
          if (typeof executorModule.executeBashCommand === 'function') {
            return await executorModule.executeBashCommand(commands || code, { workingDirectory, timeout });
          } else {
            throw new Error('executeBashCommand function not available in unified-executor module');
          }
        } else if (runtime === 'nodejs' || runtime === 'auto') {
          if (typeof executorModule.executeNodeCode === 'function') {
            return await executorModule.executeNodeCode(code, { workingDirectory, timeout });
          } else {
            throw new Error('executeNodeCode function not available in unified-executor module');
          }
        } else if (runtime === 'deno') {
          if (typeof executorModule.executeDenoCode === 'function') {
            return await executorModule.executeDenoCode(code, { workingDirectory, timeout });
          } else {
            throw new Error('executeDenoCode function not available in unified-executor module');
          }
        }
        break;
      }

      case 'searchcode': {
        const { query, searchPath = '.' } = operation;
        // Import and call searchCode function
        const vectorModule = await import('./unified-vector.js');
        if (typeof vectorModule.searchCode === 'function') {
          return await vectorModule.searchCode(query, workingDirectory, [searchPath]);
        } else {
          throw new Error('searchCode function not available in unified-vector module');
        }
      }

      case 'parse_ast': {
        const { filePath, language = 'javascript', code: astCode } = operation;
        // Import and call parseAST function
        const astToolsModule = await import('./ast-tools.js');

        // If filePath is provided but no code, read the file first
        let codeToParse = astCode;
        if (filePath && !astCode) {
          try {
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.resolve(workingDirectory, filePath);
            codeToParse = fs.readFileSync(fullPath, 'utf8');
          } catch (error) {
            throw new Error(`Failed to read file ${filePath}: ${error.message}`);
          }
        }

        if (!codeToParse) {
          throw new Error('Missing required parameters: Either code or filePath must be provided');
        }

        if (typeof astToolsModule.parseAST === 'function') {
          return await astToolsModule.parseAST(codeToParse, language, workingDirectory, filePath);
        } else {
          throw new Error('parseAST function not available in ast-tools module');
        }
      }

      case 'astgrep_search': {
        const { pattern: searchPattern, grepPath: searchGrepPath = '.' } = operation;
        // Import and call astgrepSearch function
        const astToolsModule = await import('./ast-tools.js');
        console.log('DEBUG: astToolsModule keys:', Object.keys(astToolsModule));
        console.log('DEBUG: astgrepSearch type:', typeof astToolsModule.astgrepSearch);
        if (typeof astToolsModule.astgrepSearch === 'function') {
          const result = await astToolsModule.astgrepSearch(searchPattern, searchGrepPath, workingDirectory);
          console.log('DEBUG: astgrepSearch call successful');
          return result;
        } else {
          console.log('DEBUG: astgrepSearch not a function, available functions:', Object.keys(astToolsModule).filter(k => typeof astToolsModule[k] === 'function'));
          throw new Error('astgrepSearch function not available in ast-tools module');
        }
      }

      case 'astgrep_replace': {
        const { pattern: replacePattern, replacement, grepPath: replaceGrepPath = '.' } = operation;
        // Import and call astgrepReplace function
        const astToolsModule = await import('./ast-tools.js');
        if (typeof astToolsModule.astgrepReplace === 'function') {
          return await astToolsModule.astgrepReplace(replacePattern, replacement, replaceGrepPath, workingDirectory);
        } else {
          throw new Error('astgrepReplace function not available in ast-tools module');
        }
      }

      case 'astgrep_lint': {
        const { path: lintPath, rules: lintRules } = operation;
        // Import and call astgrepLint function
        const astToolsModule = await import('./ast-tools.js');
        if (typeof astToolsModule.astgrepLint === 'function') {
          return await astToolsModule.astgrepLint(lintPath, lintRules, workingDirectory);
        } else {
          throw new Error('astgrepLint function not available in ast-tools module');
        }
      }

      case 'retrieve_overflow': {
        const { contentId, cursor, listFiles } = operation;
        // Import and call handleRetrieveOverflow function
        const overflowModule = await import('./overflow-handler.js');
        if (typeof overflowModule.handleRetrieveOverflow === 'function') {
          return await overflowModule.handleRetrieveOverflow({ workingDirectory, contentId, cursor, listFiles });
        } else {
          throw new Error('handleRetrieveOverflow function not available in overflow-handler module');
        }
      }

      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  } catch (error) {
    // Enhance error with operation-specific context
    const enhancedError = new Error(`Operation '${operation.type}' failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.operationType = operation.type;
    throw enhancedError;
  }
}

function formatBatchResults(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return {
    summary: {
      totalOperations: results.length,
      successful: successful.length,
      failed: failed.length
    },
    results: results.map((result, index) => ({
      index,
      success: result.success,
      result: result.success ? result : {
        error: result.error,
        errorType: result.errorType,
        recoverySuggestions: result.recoverySuggestions,
        operationType: result.operationType
      },
      executionTimeMs: result.executionTimeMs
    }))
  };
}

export const batchTools = [
  {
    name: "batch_execute",
    description: "Execute multiple glootie tools in a single batch operation. Supports: execute, searchcode, parse_ast, astgrep_search, astgrep_replace, astgrep_lint, retrieve_overflow. Use this 10:1 over single tool calls when possible.",
    supported_operations: ["all glootie tools"],
    unsupported_operations: ["all non glootie tools"],
    use_cases: ["Multiple file operations", "Batch processing", "Multiple tasks are already planned and ready"],
    inputSchema: {
      type: "object",
      properties: {
        workingDirectory: {
          type: "string",
          description: "REQUIRED: Working directory for execution."
        },
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["execute", "searchcode", "parse_ast", "astgrep_search", "astgrep_replace", "astgrep_lint", "retrieve_overflow"]
              },
              // For execute operations
              code: {
                type: "string",
                description: "JavaScript/TypeScript code to execute (for execute type)"
              },
              runtime: {
                type: "string",
                enum: ["nodejs", "deno", "bash", "auto"],
                description: "Runtime for code execution (for execute type)"
              },
              commands: {
                type: "string",
                description: "Bash commands to execute (for execute type with bash runtime)"
              },
              timeout: {
                type: "number",
                description: "Timeout in milliseconds (for execute type)"
              },
              // For searchcode operations
              query: {
                type: "string",
                description: "Search query (for searchcode type)"
              },
              searchPath: {
                type: "string",
                description: "Path to search within (for searchcode type, defaults to working directory)"
              },
              // For parse_ast operations
              filePath: {
                type: "string",
                description: "File path to parse (for parse_ast type)"
              },
              language: {
                type: "string",
                description: "Programming language (for parse_ast type)"
              },
              // For astgrep operations
              pattern: {
                type: "string",
                description: "AST-grep pattern (for astgrep_search, astgrep_replace, astgrep_lint types)"
              },
              replacement: {
                type: "string",
                description: "Replacement pattern (for astgrep_replace type)"
              },
              grepPath: {
                type: "string",
                description: "Path to search/replace in (for astgrep operations)"
              },
              // For retrieve_overflow operations
              contentId: {
                type: "string",
                description: "Content ID to retrieve (for retrieve_overflow type)"
              },
              cursor: {
                type: "string",
                description: "Pagination cursor (for retrieve_overflow type)"
              },
              listFiles: {
                type: "boolean",
                description: "List available items (for retrieve_overflow type)"
              }
            },
            required: ["type"]
          },
          description: "Array of glootie tool operations to execute"
        }
      },
      required: ["workingDirectory", "operations"]
    },
    handler: createRecoveryToolHandler(async ({ operations, workingDirectory }) => {
      const startTime = Date.now();

      const paramError = validateRequiredParams({ operations, workingDirectory }, ['operations', 'workingDirectory'], startTime);
      if (paramError) return paramError;

      const dirValidation = validateWorkingDirectory(workingDirectory);
      if (!dirValidation.valid) {
        return createErrorResponse(dirValidation.error, startTime);
      }

      const results = [];

      for (const operation of operations) {
        try {
          const result = await executeBatchOperation(operation, dirValidation.effectiveDir);
          results.push(result);
        } catch (error) {
          // Classify the error and get recovery suggestions
          const errorInfo = classifyError(error, operation.type);
          const recovery = getRecoveryAction(errorInfo, operation.type);

          results.push({
            success: false,
            error: error.message,
            errorType: errorInfo.type,
            recoverySuggestions: recovery.alternatives,
            operationType: operation.type,
            executionTimeMs: Date.now() - startTime
          });
        }
      }

      return createSuccessResponse(formatBatchResults(results), startTime);
    }, 'batch_execute', 300000)
  }
];

// Export executeBatchOperation for direct use
export { executeBatchOperation };