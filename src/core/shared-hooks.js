import { withErrorHandling, ValidationError, ExecutionError, SearchError, ToolErrorHandler } from './error-handling.js';

function createToolResponse(content, isError = false) {
  return {
    content: [{ type: "text", text: content }],
    isError
  };
}

function createErrorResponse(message) {
  return createToolResponse(`Error: ${message}`, true);
}

function createSuccessResponse(data) {
  return createToolResponse(JSON.stringify(data, null, 2));
}

function validateRequiredParams(params, requiredParams) {
  const missingParams = requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new ValidationError(`Missing required parameters: ${missingParams.join(', ')}`);
  }
}

function createToolHandler(handler, toolName = 'Unknown Tool') {
  return withErrorHandling(
    async (args) => {
      const result = await handler(args);
      return result;
    },
    toolName
  );
}

function createTimeoutToolHandler(handler, toolName = 'Unknown Tool', timeoutMs = 30000) {
  return createAdvancedToolHandler(handler, toolName, {
    timeout: timeoutMs,
    enableTimeout: true
  });
}

function createRetryToolHandler(handler, toolName = 'Unknown Tool', retries = 3) {
  return createAdvancedToolHandler(handler, toolName, {
    retries,
    enableRetry: true,
    retryDelay: 1000
  });
}

function createAdvancedToolHandlerUtil(handler, toolName = 'Unknown Tool', options = {}) {
  return createAdvancedToolHandler(handler, toolName, options);
}

export const COMMON_SCHEMAS = {
  workingDirectory: {
    type: "string",
    description: "REQUIRED: Working directory for execution."
  },
  timeout: {
    type: "number",
    description: "Timeout in milliseconds (default: 120000)"
  },
  path: {
    type: "string",
    description: "Path to search in"
  },
  query: {
    type: "string",
    description: "Search query"
  },
  code: {
    type: "string",
    description: "JavaScript/TypeScript code to execute"
  },
  commands: {
    type: ["string", "array"],
    description: "Bash commands (single or array for planned batch executions)"
  },
  runtime: {
    type: "string",
    enum: ["nodejs", "deno", "bash", "auto"],
    description: "Execution runtime (default: auto-detect)"
  }
};

export const DEFAULT_PARAMS = {
  runtime: 'auto',
  timeout: 120000,
  path: '.',
  language: 'javascript',
  chunkIndex: 0,
  listFiles: false,
  cleanup: false
};

export function createToolConfig(name, description, inputSchema, handler) {
  return {
    name,
    description,
    inputSchema,
    handler: createToolHandler(handler, name)
  };
}

export function createEnhancedToolHandler(handler, toolName, requiredParams = []) {
  return createToolHandler(async (args) => {
    validateRequiredParams(args, requiredParams);
    return await handler(args);
  }, toolName);
}

export const responseFormatters = {
  search: (results, query, path) => {
    if (results.length === 0) {
      return createToolResponse(`No results found for "${query}" in ${path}`);
    }
    return createSuccessResponse({
      count: results.length,
      query,
      path,
      results
    });
  },

  execution: (workingDirectory, runtime = DEFAULT_PARAMS.runtime) => {
    return createToolResponse(`Execution requested in ${workingDirectory} with runtime ${runtime}`);
  },

  batch: (operations) => {
    return createToolResponse(`Batch executing ${operations.length} operations`);
  },

  ast: (operation, details) => {
    return createToolResponse(`AST ${operation}: ${JSON.stringify(details, null, 2)}`);
  }
};

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
    throw new Error(`Error: ${message}`);
  }
};

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
  },

  withTimeout: (name, description, handler, additionalProperties = {}, timeoutMs = 30000) => {
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
      createTimeoutToolHandler(handler, name, timeoutMs)
    );
  },

  withRetry: (name, description, handler, additionalProperties = {}, retries = 3) => {
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
      createRetryToolHandler(handler, name, retries)
    );
  },

  withAdvanced: (name, description, handler, additionalProperties = {}, options = {}) => {
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
      createAdvancedToolHandlerUtil(handler, name, options)
    );
  }
};

export const toolUtils = {
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

export function createErrorBoundary(toolName) {
  return new ToolErrorBoundary(toolName);
}