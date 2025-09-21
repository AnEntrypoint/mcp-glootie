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


// Simple error response for tools
export function createEnhancedErrorResponse(error, operationType = null, context = {}) {
  const errorMessage = error?.message || error || 'Unknown error';
  return createToolResponse(`Error: ${errorMessage}`, true);
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

