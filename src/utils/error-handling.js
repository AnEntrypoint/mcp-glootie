import { TOOL_STRINGS } from '../constants/tool-strings.js';

// TypeScript-style interfaces implemented in JavaScript
export class ToolError extends Error {
  constructor(message, code = 'TOOL_ERROR', toolName = 'unknown', retryable = false, suggestions = []) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.tool = toolName;
    this.timestamp = Date.now();
    this.retryable = retryable;
    this.suggestions = suggestions;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      tool: this.tool,
      timestamp: this.timestamp,
      retryable: this.retryable,
      suggestions: this.suggestions
    };
  }
}

export class ValidationError extends ToolError {
  constructor(message, toolName = 'unknown') {
    super(message, 'VALIDATION_ERROR', toolName, false, [
      'Check that all required parameters are provided',
      'Verify parameter types match the expected schema',
      'Review the tool documentation for parameter requirements'
    ]);
    this.name = 'ValidationError';
  }
}

export class ExecutionError extends ToolError {
  constructor(message, toolName = 'unknown') {
    super(message, 'EXECUTION_ERROR', toolName, true, [
      'Try running the operation again',
      'Check if the working directory is accessible',
      'Verify that required dependencies are installed'
    ]);
    this.name = 'ExecutionError';
  }
}

export class SearchError extends ToolError {
  constructor(message, toolName = 'unknown') {
    super(message, 'SEARCH_ERROR', toolName, true, [
      'Try a different search query',
      'Check if the search path exists',
      'Consider using a more specific search pattern'
    ]);
    this.name = 'SearchError';
  }
}

export class TimeoutError extends ToolError {
  constructor(message, toolName = 'unknown', timeoutMs = 0) {
    super(message, 'TIMEOUT', toolName, true, [
      'Try reducing the scope of the operation',
      'Consider using a simpler tool for this task',
      'Break the operation into smaller chunks',
      `Increase timeout beyond ${timeoutMs}ms if needed`
    ]);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class PermissionError extends ToolError {
  constructor(message, toolName = 'unknown') {
    super(message, 'PERMISSION_DENIED', toolName, false, [
      'Check file and directory permissions',
      'Ensure the tool has necessary access rights',
      'Try running with appropriate permissions'
    ]);
    this.name = 'PermissionError';
  }
}

export class NetworkError extends ToolError {
  constructor(message, toolName = 'unknown') {
    super(message, 'NETWORK_ERROR', toolName, true, [
      'Check your internet connection',
      'Verify the target URL is accessible',
      'Try the operation again in a few moments'
    ]);
    this.name = 'NetworkError';
  }
}

export class ResourceError extends ToolError {
  constructor(message, toolName = 'unknown') {
    super(message, 'RESOURCE_ERROR', toolName, true, [
      'Check available disk space and memory',
      'Close unnecessary applications',
      'Try processing smaller amounts of data'
    ]);
    this.name = 'ResourceError';
  }
}

// Enhanced ToolErrorHandler class
export class ToolErrorHandler {
  constructor(toolName = 'unknown') {
    this.toolName = toolName;
  }

  handleError(error, context = {}) {
    // If it's already a ToolError, just update the tool name if needed
    if (error instanceof ToolError) {
      if (error.tool === 'unknown') {
        error.tool = this.toolName;
      }
      return error;
    }

    // Handle specific error types
    if (error.code === 'ENOENT' || error.message.includes('no such file')) {
      return new ToolError(
        `File or directory not found: ${error.message}`,
        'FILE_NOT_FOUND',
        this.toolName,
        false,
        [
          'Verify the file path is correct',
          'Check if the file exists in the working directory',
          'Ensure proper file permissions'
        ]
      );
    }

    if (error.code === 'EACCES' || error.message.includes('permission denied')) {
      return new PermissionError(
        `Permission denied: ${error.message}`,
        this.toolName
      );
    }

    if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
      return new TimeoutError(
        `Operation timed out: ${error.message}`,
        this.toolName,
        context.timeout || 0
      );
    }

    if (error.code === 'ENOTDIR' || error.message.includes('not a directory')) {
      return new ValidationError(
        `Invalid directory path: ${error.message}`,
        this.toolName
      );
    }

    if (error.code === 'EMFILE' || error.code === 'ENFILE' || error.message.includes('too many files')) {
      return new ResourceError(
        `Resource limit exceeded: ${error.message}`,
        this.toolName
      );
    }

    if (error.message.includes('network') || error.message.includes('connection')) {
      return new NetworkError(
        `Network error: ${error.message}`,
        this.toolName
      );
    }

    // Default case - create a generic ToolError
    return new ToolError(
      error.message || 'Unknown error occurred',
      'UNKNOWN_ERROR',
      this.toolName,
      true,
      [
        'Try the operation again',
        'Check the console for more details',
        'Contact support if the problem persists'
      ]
    );
  }

  async withTimeout(operation, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(
          `Operation timed out after ${timeoutMs}ms`,
          this.toolName,
          timeoutMs
        ));
      }, timeoutMs);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(this.handleError(error, { timeout: timeoutMs }));
        });
    });
  }

  async withRetry(operation, maxRetries = 3, delayMs = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = this.handleError(error);

        if (!lastError.retryable || attempt === maxRetries) {
          throw lastError;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }

    throw lastError;
  }
}

export function createErrorHandler(toolName) {
  const errorHandler = new ToolErrorHandler(toolName);
  return async (operation, errorMessage = `${toolName} failed`) => {
    try {
      return await operation();
    } catch (error) {
      throw errorHandler.handleError(error);
    }
  };
}

export function withErrorHandling(handler, toolName) {
  const errorHandler = new ToolErrorHandler(toolName);

  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      const toolError = errorHandler.handleError(error);
      console.error(`Error in ${toolName}:`, toolError.toJSON());

      // Create detailed error response with suggestions
      const errorText = [
        `${toolError.code}: ${toolError.message}`,
        '',
        'Suggestions:',
        ...toolError.suggestions.map(s => `• ${s}`)
      ].join('\n');

      if (toolError.retryable) {
        return {
          content: [{
            type: "text",
            text: `${errorText}\n\nThis error is retryable. You may try the operation again.`
          }],
          isError: true
        };
      }

      return {
        content: [{ type: "text", text: errorText }],
        isError: true
      };
    }
  };
}

export function validateParams(params, schema) {
  const errors = [];

  // Check required parameters
  if (schema.required) {
    for (const required of schema.required) {
      if (params[required] === undefined || params[required] === null || params[required] === '') {
        errors.push(`Missing required parameter: ${required}`);
      }
    }
  }

  // Check parameter types
  if (schema.properties) {
    for (const [key, value] of Object.entries(params)) {
      const propertySchema = schema.properties[key];
      if (propertySchema && value !== undefined) {
        if (propertySchema.type && !validateType(value, propertySchema.type)) {
          errors.push(`Invalid type for parameter ${key}: expected ${propertySchema.type}`);
        }

        if (propertySchema.enum && !propertySchema.enum.includes(value)) {
          errors.push(`Invalid value for parameter ${key}: must be one of ${propertySchema.enum.join(', ')}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join(', '));
  }
}

function validateType(value, expectedType) {
  if (Array.isArray(expectedType)) {
    return expectedType.some(type => validateType(value, type));
  }

  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

export function createToolErrorHandler(toolName) {
  return new ToolErrorHandler(toolName);
}

// Enhanced tool handler factory with timeout and retry support
export function createAdvancedToolHandler(handler, toolName, options = {}) {
  const {
    timeout = 30000,
    retries = 1,
    retryDelay = 1000,
    enableTimeout = false,
    enableRetry = false
  } = options;

  const errorHandler = new ToolErrorHandler(toolName);

  return async (args) => {
    let operation = () => handler(args);

    if (enableTimeout) {
      const originalOperation = operation;
      operation = () => errorHandler.withTimeout(originalOperation, timeout);
    }

    if (enableRetry) {
      const originalOperation = operation;
      operation = () => errorHandler.withRetry(originalOperation, retries, retryDelay);
    }

    try {
      return await operation();
    } catch (error) {
      const toolError = errorHandler.handleError(error);
      console.error(`Error in ${toolName}:`, toolError.toJSON());

      const errorText = [
        `${toolError.code}: ${toolError.message}`,
        '',
        'Suggestions:',
        ...toolError.suggestions.map(s => `• ${s}`)
      ].join('\n');

      if (toolError.retryable && !enableRetry) {
        return {
          content: [{
            type: "text",
            text: `${errorText}\n\nThis error is retryable. You may try the operation again.`
          }],
          isError: true
        };
      }

      return {
        content: [{ type: "text", text: errorText }],
        isError: true
      };
    }
  };
}