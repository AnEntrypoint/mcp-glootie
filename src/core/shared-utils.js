// Shared utilities module - extracted from duplicate functions across the codebase
import { existsSync, statSync } from 'fs';
import * as path from 'node:path';

// Default ignore patterns used across multiple modules
export function getDefaultIgnorePatterns() {
  return [
    'node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '*.log',
    '*.tmp',
    '.env*',
    'coverage/**',
    '.next/**',
    '.nuxt/**',
    '.out/**',
    'target/**',        // Rust/Java
    'vendor/**',        // PHP/Go
    'packages/**',      // Monorepos
    '**/test/**',       // Test files
    '**/*.test.*',      // Test files
    '**/*.spec.*',      // Test files
    '**/*.min.*',       // Minified files
    '**/bundle.*',      // Bundle files
    '**/coverage/**',   // Coverage reports
    '**/.cache/**',     // Cache directories
    '**/.temp/**',      // Temp directories
    '**/temp/**',       // Temp directories
    '**/tmp/**',        // Temp directories
    '**/docs/**',       // Documentation
    '**/*.md',          // Markdown files
    '**/*.txt',         // Text files
    '**/*.json',        // JSON files (config)
    '**/*.yaml',        // YAML files
    '**/*.yml',         // YAML files
    '**/*.toml',        // TOML files
    '**/package.json',  // Package configs
    '**/tsconfig.json', // TypeScript configs
    '**/jest.config.*', // Test configs
    '**/webpack.config.*', // Build configs
    '**/vite.config.*', // Build configs
  ];
}

// Tool response creation - standardized across all tools
export function createToolResponse(data, startTime, context = {}) {
  return {
    success: true,
    executionTimeMs: Date.now() - startTime,
    ...data,
    ...context
  };
}

// Error response creation - standardized across all tools
export function createErrorResponse(error, startTime, context = {}) {
  return {
    success: false,
    error: error?.message || error || 'Unknown error occurred',
    executionTimeMs: Date.now() - startTime,
    ...context
  };
}

// Parameter validation - standardized across all tools
export function validateRequiredParams(args, requiredParams, startTime) {
  const missingParams = requiredParams.filter(param => !args[param]);
  if (missingParams.length > 0) {
    return createErrorResponse(
      new Error(`Missing required parameters: ${missingParams.join(', ')}`),
      startTime
    );
  }
  return null;
}

// Working directory validation - used by multiple tools
export function validateWorkingDirectory(workingDirectory, defaultWorkingDir) {
  if (!workingDirectory) {
    return {
      valid: false,
      error: 'workingDirectory parameter is required for this operation',
      effectiveDir: null
    };
  }

  try {
    const resolvedPath = path.resolve(workingDirectory);

    if (!existsSync(resolvedPath)) {
      return {
        valid: false,
        error: `Working directory '${workingDirectory}' does not exist`,
        effectiveDir: null
      };
    }

    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: `Path '${workingDirectory}' is not a directory`,
        effectiveDir: null
      };
    }

    return {
      valid: true,
      effectiveDir: resolvedPath
    };
  } catch (error) {
    return {
      valid: false,
      error: `Error accessing working directory: ${error.message}`,
      effectiveDir: null
    };
  }
}