import { TOOL_STRINGS } from '../constants/tool-strings.js';
import { ValidationError, withErrorHandling } from './error-handling.js';

export function createToolResponse(content, isError = false) {
  return {
    content: [{ type: "text", text: content }],
    isError
  };
}

export function createErrorResponse(message) {
  return createToolResponse(`${TOOL_STRINGS.ERROR_PREFIX} ${message}`, true);
}

export function createSuccessResponse(data) {
  return createToolResponse(JSON.stringify(data, null, 2));
}

export function validateRequiredParams(params, requiredParams) {
  const missingParams = requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new ValidationError(`Missing required parameters: ${missingParams.join(', ')}`);
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

  // Try to read custom ignore patterns from the working directory
  try {
    const fs = require('fs');
    const path = require('path');

    // Check for custom search defaults
    const searchDefaultsPath = path.join(workingDirectory, '.search-defaults.json');
    if (fs.existsSync(searchDefaultsPath)) {
      const customDefaults = JSON.parse(fs.readFileSync(searchDefaultsPath, 'utf8'));
      return { ...defaultPatterns, ...customDefaults };
    }

    // Check for .gitignore
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
    // If we can't read files, just return defaults
    console.warn('Warning: Could not read ignore patterns, using defaults:', error.message);
  }

  return defaultPatterns;
}

export function formatSearchResults(results, query, path) {
  if (results.length === 0) {
    return `${TOOL_STRINGS.NO_RESULTS_FOUND} for "${query}" in ${path}`;
  }

  return `${TOOL_STRINGS.FOUND_RESULTS} ${results.length} ${TOOL_STRINGS.RESULTS_FOR} "${query}" in ${path}:\n\n${results.map(r => `${r.file}:${r.startLine}-${r.endLine}\n${r.content.substring(0, 200)}...\nScore: ${r.score.toFixed(3)}`).join('\n\n')}`;
}

export function formatExecutionMessage(workingDirectory, runtime = TOOL_STRINGS.DEFAULT_RUNTIME) {
  return `${TOOL_STRINGS.EXECUTION_REQUESTED} ${workingDirectory} with runtime ${runtime}`;
}

export function formatBatchOperationMessage(operations) {
  return `${TOOL_STRINGS.BATCH_EXECUTING} ${operations.length} ${TOOL_STRINGS.OPERATIONS}`;
}

export function formatOverflowRetrievalMessage(workingDirectory) {
  return `${TOOL_STRINGS.OVERFLOW_RETRIEVAL_REQUESTED} ${workingDirectory}`;
}

export function formatCodeParsingMessage(language, code) {
  return `${TOOL_STRINGS.PARSINCODE} ${language} ${TOOL_STRINGS.CODE_SUBSTRING} ${code.substring(0, 100)}...`;
}

export function formatASTSearchMessage(pattern, path) {
  return `AST searching: ${pattern} in ${path}`;
}

export function formatASTReplaceMessage(pattern, replacement, path) {
  return `AST replacing: ${pattern} -> ${replacement} in ${path}`;
}

export function formatASTLintMessage(path) {
  return `AST linting: ${path}`;
}

export function getDefaultValues() {
  return {
    runtime: TOOL_STRINGS.DEFAULT_RUNTIME,
    timeout: TOOL_STRINGS.DEFAULT_TIMEOUT,
    path: TOOL_STRINGS.DEFAULT_PATH,
    language: TOOL_STRINGS.DEFAULT_LANGUAGE,
    chunkIndex: TOOL_STRINGS.DEFAULT_CHUNK_INDEX,
    listFiles: TOOL_STRINGS.DEFAULT_LIST_FILES,
    cleanup: TOOL_STRINGS.DEFAULT_CLEANUP
  };
}

export async function safeExecute(operation, errorMessage = "Operation failed") {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`${errorMessage}: ${error.message}`);
  }
}

export function createToolHandler(handler, toolName = 'Unknown Tool') {
  return withErrorHandling(
    async (args) => {
      const result = await handler(args);
      return result;
    },
    toolName
  );
}