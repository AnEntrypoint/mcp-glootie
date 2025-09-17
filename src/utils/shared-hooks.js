// Shared hooks and utilities for MCP Glootie tools
// This module consolidates common patterns and utilities used across the codebase

import { TOOL_STRINGS } from '../constants/tool-strings.js';
import {
  createToolHandler,
  validateRequiredParams,
  createToolResponse,
  createErrorResponse,
  createSuccessResponse
} from './tool-utils.js';
import { withErrorHandling, ValidationError, ExecutionError, SearchError } from './error-handling.js';

/**
 * Common validation schemas for tool parameters
 */
export const COMMON_SCHEMAS = {
  workingDirectory: {
    type: "string",
    description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION
  },
  timeout: {
    type: "number",
    description: TOOL_STRINGS.TIMEOUT_DESCRIPTION
  },
  path: {
    type: "string",
    description: TOOL_STRINGS.PATH_DESCRIPTION
  },
  query: {
    type: "string",
    description: TOOL_STRINGS.QUERY_DESCRIPTION
  },
  code: {
    type: "string",
    description: TOOL_STRINGS.CODE_DESCRIPTION
  },
  commands: {
    type: ["string", "array"],
    description: TOOL_STRINGS.COMMANDS_DESCRIPTION
  },
  runtime: {
    type: "string",
    enum: ["nodejs", "deno", "bash", "auto"],
    description: TOOL_STRINGS.RUNTIME_DESCRIPTION
  }
};

/**
 * Default parameters that can be used across tools
 */
export const DEFAULT_PARAMS = {
  runtime: TOOL_STRINGS.DEFAULT_RUNTIME,
  timeout: TOOL_STRINGS.DEFAULT_TIMEOUT,
  path: TOOL_STRINGS.DEFAULT_PATH,
  language: TOOL_STRINGS.DEFAULT_LANGUAGE,
  chunkIndex: TOOL_STRINGS.DEFAULT_CHUNK_INDEX,
  listFiles: TOOL_STRINGS.DEFAULT_LIST_FILES,
  cleanup: TOOL_STRINGS.DEFAULT_CLEANUP
};

/**
 * Factory function to create a complete tool configuration
 */
export function createToolConfig(name, description, inputSchema, handler) {
  return {
    name,
    description,
    inputSchema,
    handler: createToolHandler(handler, name)
  };
}

/**
 * Enhanced tool handler with validation and error handling
 */
export function createEnhancedToolHandler(handler, toolName, requiredParams = []) {
  return createToolHandler(async (args) => {
    validateRequiredParams(args, requiredParams);
    return await handler(args);
  }, toolName);
}

/**
 * Common response formatters
 */
export const responseFormatters = {
  search: (results, query, path) => {
    if (results.length === 0) {
      return createToolResponse(`${TOOL_STRINGS.NO_RESULTS_FOUND} for "${query}" in ${path}`);
    }
    return createSuccessResponse({
      count: results.length,
      query,
      path,
      results
    });
  },

  execution: (workingDirectory, runtime = DEFAULT_PARAMS.runtime) => {
    return createToolResponse(`${TOOL_STRINGS.EXECUTION_REQUESTED} ${workingDirectory} with runtime ${runtime}`);
  },

  batch: (operations) => {
    return createToolResponse(`${TOOL_STRINGS.BATCH_EXECUTING} ${operations.length} ${TOOL_STRINGS.OPERATIONS}`);
  },

  ast: (operation, details) => {
    return createToolResponse(`AST ${operation}: ${JSON.stringify(details, null, 2)}`);
  }
};

/**
 * Common error handling patterns
 */
export const errorHandlers = {
  validation: (message) => {
    throw new ValidationError(message);
  },

  execution: (message) => {
    throw new ExecutionError(message);
  },

  search: (message) => {
    throw new SearchError(message);
  },

  general: (message) => {
    throw new Error(`${TOOL_STRINGS.ERROR_PREFIX} ${message}`);
  }
};

/**
 * Tool creation helpers for common patterns
 */
export const toolCreators = {
  simple: (name, description, handler, requiredParams = []) => {
    return createToolConfig(
      name,
      description,
      {
        type: "object",
        properties: {},
        required: requiredParams
      },
      createEnhancedToolHandler(handler, name, requiredParams)
    );
  },

  withWorkingDirectory: (name, description, handler, additionalProperties = {}) => {
    return createToolConfig(
      name,
      description,
      {
        type: "object",
        properties: {
          workingDirectory: COMMON_SCHEMAS.workingDirectory,
          ...additionalProperties
        },
        required: ["workingDirectory"]
      },
      createEnhancedToolHandler(handler, name, ["workingDirectory"])
    );
  },

  searchBased: (name, description, handler, additionalRequired = []) => {
    return createToolConfig(
      name,
      description,
      {
        type: "object",
        properties: {
          query: COMMON_SCHEMAS.query,
          path: COMMON_SCHEMAS.path,
          workingDirectory: COMMON_SCHEMAS.workingDirectory
        },
        required: ["query", "workingDirectory", ...additionalRequired]
      },
      createEnhancedToolHandler(handler, name, ["query", "workingDirectory", ...additionalRequired])
    );
  }
};

/**
 * Utility functions for tool orchestration
 */
export const toolUtils = {
  /**
   * Safely execute multiple operations and return aggregated results
   */
  async executeBatch(operations, options = {}) {
    const { concurrency = 5, stopOnError = false } = options;
    const results = [];
    const errors = [];

    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchPromises = batch.map(async (operation, index) => {
        try {
          const result = await operation();
          return { success: true, result, index: i + index };
        } catch (error) {
          errors.push({ error, index: i + index });
          if (stopOnError) {
            throw error;
          }
          return { success: false, error: error.message, index: i + index };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return { results, errors };
  },

  /**
   * Create a retry wrapper for operations
   */
  withRetry(operation, maxRetries = 3, delay = 1000) {
    return async (...args) => {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation(...args);
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
          }
        }
      }
      throw lastError;
    };
  },

  /**
   * Create a timeout wrapper for operations
   */
  withTimeout(operation, timeoutMs = DEFAULT_PARAMS.timeout) {
    return async (...args) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      return Promise.race([
        operation(...args),
        timeoutPromise
      ]);
    };
  }
};

/**
 * React-style error boundary simulation for tool operations
 */
export class ToolErrorBoundary {
  constructor(toolName) {
    this.toolName = toolName;
    this.errors = [];
  }

  async execute(operation) {
    try {
      return await operation();
    } catch (error) {
      this.errors.push(error);
      console.error(`Error in ${this.toolName}:`, error);

      if (error instanceof ValidationError) {
        return createErrorResponse(`Validation Error: ${error.message}`);
      }

      if (error instanceof ExecutionError) {
        return createErrorResponse(`Execution Error: ${error.message}`);
      }

      if (error instanceof SearchError) {
        return createErrorResponse(`Search Error: ${error.message}`);
      }

      return createErrorResponse(error.message);
    }
  }

  getErrors() {
    return this.errors;
  }

  clearErrors() {
    this.errors = [];
  }
}

/**
 * Create an error boundary for a specific tool
 */
export function createErrorBoundary(toolName) {
  return new ToolErrorBoundary(toolName);
}