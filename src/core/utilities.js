import { existsSync } from 'fs';
import { join, resolve } from 'path';


export function createToolResponse(content, isError = false) {
  return {
    content: [{ type: "text", text: content }],
    isError
  };
}

export function createErrorResponse(message, details = null) {
  let response = `❌ Error: ${message}`;
  if (details) {
    response += `\n\n${details}`;
  }
  return createToolResponse(response, true);
}


export function validateRequiredParams(params, requiredParams) {
  const missing = requiredParams.filter(param => !params[param]);
  if (missing.length > 0) {
    return {
      isValid: false,
      error: `Missing required parameters: ${missing.join(', ')}`
    };
  }
  return { isValid: true };
}

export function validateWorkingDirectory(workingDir) {
  if (!workingDir) {
    return {
      isValid: false,
      error: 'Working directory is required'
    };
  }

  const resolvedDir = resolve(workingDir);

  if (!existsSync(resolvedDir)) {
    return {
      isValid: false,
      error: `Working directory does not exist: ${resolvedDir}`
    };
  }

  return { isValid: true, resolvedDir };
}


export function truncateContent(content, maxLength = 10000) {
  if (content.length <= maxLength) {
    return content;
  }

  const truncated = content.substring(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastNewline > maxLength * 0.8) {
    return truncated.substring(0, lastNewline) + '\n...[truncated]';
  }

  return truncated + '\n...[truncated]';
}

export function formatToolResponse(content) {
  return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
}


export function createTimeoutPromise(timeoutMs, operation = 'Operation') {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}


export function handleAsyncError(error, context = 'Operation') {
  console.error(`❌ ${context} error:`, error);

  if (error.code === 'ENOENT') {
    return createErrorResponse('File not found', error.message);
  }

  if (error.code === 'EACCES') {
    return createErrorResponse('Permission denied', error.message);
  }

  if (error.name === 'TimeoutError') {
    return createErrorResponse('Operation timed out', 'The operation took too long to complete');
  }

  return createErrorResponse(`${context} failed`, error.message);
}


export function getDefaultIgnorePatterns() {
  return [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    'out/**',
    '.next/**',
    '.nuxt/**',
    '.cache/**',
    '.vscode/**',
    '.idea/**',
    '*.log',
    '*.tmp',
    '.env*',
    'coverage/**',
    '.pytest_cache/**',
    '__pycache__/**',
    '*.pyc',
    '.DS_Store',
    'Thumbs.db',
    '*.min.js',
    '*.min.css',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml'
  ];
}

export function shouldIgnoreFile(filePath, ignorePatterns = null) {
  if (!ignorePatterns) {
    ignorePatterns = getDefaultIgnorePatterns();
  }

  const normalizedPath = filePath.replace(/\\/g, '/');

  return ignorePatterns.some(pattern => {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(normalizedPath);
    } catch (e) {
      return normalizedPath.includes(pattern.replace(/\*\*/g, '').replace(/\*/g, ''));
    }
  });
}


export function createToolConfig(name, description, inputSchema, handler) {
  return {
    name,
    description,
    inputSchema,
    handler: createToolHandler(handler, name)
  };
}

function createToolHandler(handler, toolName) {
  return async (args) => {
    try {
      console.log(`🔧 Executing ${toolName} with args:`, JSON.stringify(args, null, 2));
      const result = await handler(args);
      console.log(`✅ ${toolName} completed successfully`);
      return result;
    } catch (error) {
      console.error(`❌ ${toolName} failed:`, error);
      return handleAsyncError(error, toolName);
    }
  };
}


export function ensureAbsolutePaths(paths, basePath) {
  return paths.map(path => {
    if (path.startsWith('/')) {
      return path;
    }
    return join(basePath, path);
  });
}

export function getRelativePath(filePath, basePath) {
  const absolutePath = resolve(filePath);
  const absoluteBase = resolve(basePath);

  if (absolutePath.startsWith(absoluteBase)) {
    return absolutePath.substring(absoluteBase.length).replace(/^\/+/, '');
  }

  return absolutePath;
}


export function createPaginationResponse(items, page, pageSize, total) {
  const totalPages = Math.ceil(total / pageSize);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    items,
    pagination: {
      currentPage: page,
      pageSize,
      totalItems: total,
      totalPages,
      hasNext,
      hasPrev
    }
  };
}

export function createSearchQuery(term, options = {}) {
  const { exactMatch = false, caseSensitive = false } = options;

  if (exactMatch) {
    return caseSensitive ? `"${term}"` : `"${term}"`;
  }

  return caseSensitive ? term : term.toLowerCase();
}

export function highlightMatches(text, query, caseSensitive = false) {
  if (!query) return text;

  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

  return text.replace(regex, match => `**${match}**`);
}

export function logDebug(message, data = null) {
  if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
    console.log(`🔍 [DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

export function logPerformance(operation, startTime) {
  const duration = Date.now() - startTime;
  console.log(`⏱️ ${operation} completed in ${duration}ms`);

  if (duration > 5000) {
    console.warn(`⚠️ ${operation} took ${duration}ms - consider optimization`);
  }
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default {
  createToolResponse,
  createErrorResponse,
  validateRequiredParams,
  validateWorkingDirectory,
  truncateContent,
  formatToolResponse,
  createTimeoutPromise,
  handleAsyncError,
  getDefaultIgnorePatterns,
  shouldIgnoreFile,
  createToolConfig,
  ensureAbsolutePaths,
  getRelativePath,
  createPaginationResponse,
  createSearchQuery,
  highlightMatches,
  logDebug,
  logPerformance,
  generateId
};