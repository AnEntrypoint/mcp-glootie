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

    // Test and benchmark directories
    '**/test/**',       // Test files
    '**/*.test.*',      // Test files
    '**/*.spec.*',      // Test files
    'results/**',        // Benchmark results and performance data
    'optimized-test*/**', // Optimized test directories
    'debug-*/**',       // Debug directories

    // Cache and temp directories
    '**/.cache/**',     // Cache directories
    '**/.temp/**',      // Temp directories
    '**/temp/**',       // Temp directories
    '**/tmp/**',        // Temp directories
    '.cache/**',
    '.temp/**',
    'temp/**',
    'tmp/**',

    // Documentation and notes
    '**/docs/**',       // Documentation
    '**/*.md',          // Markdown files
    '**/*.txt',         // Text files

    // Configuration and data files
    '**/*.json',        // JSON files (config and data)
    '**/*.yaml',        // YAML files
    '**/*.yml',         // YAML files
    '**/*.toml',        // TOML files
    '**/*.xml',         // XML files
    '**/*.csv',         // CSV files
    '**/*.log',         // Log files

    // Specific config files
    '**/package.json',  // Package configs
    '**/tsconfig.json', // TypeScript configs
    '**/jest.config.*', // Test configs
    '**/webpack.config.*', // Build configs
    '**/vite.config.*', // Build configs
    '**/tailwind.config.*', // Tailwind configs

    // Application directories
    '.next/**',
    '.nuxt/**',
    '.out/**',
    '.public/**',

    // Development directories
    '.vscode/**',
    '.idea/**',
    '.swp/**',
    '.swo/**',

    // Data and cache directories
    'data/**',
    'cache/**',
    'logs/**',
    'storage/**',

    // Generated and output directories
    'out/**',
    'output/**',
    'generated/**',

    // Claude-specific directories
    '.claude/**',
    '.thoughts/**',
    'code_search_index/**',

    // Large file types
    '**/*.min.*',       // Minified files
    '**/bundle.*',      // Bundle files
    '**/*.map',         // Source maps
    '**/*.bak',         // Backup files
    '**/*.swp',         // Swap files
    '**/*.swo',         // Swap files

    // CommonJS and other non-source files
    '**/*.cjs',         // CommonJS files
    '**/*.mjs',         // ES modules (when they're config files)

    // Coverage and testing
    '**/coverage/**',   // Coverage reports
    '**/.nyc_output/**',
    '**/reports/**',    // Test reports

    // Build artifacts
    '**/.turbo/**',
    '**/.vercel/**',
    '**/.netlify/**',

    // Database and migration files
    '**/migrations/**',
    '**/seeds/**',
    '**/*.sql',
    '**/*.sqlite',
    '**/*.db',

    // Binary and media files
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.svg',
    '**/*.ico',
    '**/*.pdf',
    '**/*.zip',
    '**/*.tar',
    '**/*.gz',
    '**/*.bin',

    // System and OS files
    '.DS_Store',
    'Thumbs.db',
    '.gitignore',
    '.gitattributes',

    // Additional common patterns
    'lib/**',           // Library directories (often compiled)
    'bin/**',           // Binary directories
    'scripts/**',       // Build scripts (when not source)
    'tools/**',         // Build tools (when not source)
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