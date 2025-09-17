import { TOOL_STRINGS } from '../constants/tool-strings.js';

export class ToolError extends Error {
  constructor(message, code = 'TOOL_ERROR') {
    super(message);
    this.name = 'ToolError';
    this.code = code;
  }
}

export class ValidationError extends ToolError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class ExecutionError extends ToolError {
  constructor(message) {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
  }
}

export class SearchError extends ToolError {
  constructor(message) {
    super(message, 'SEARCH_ERROR');
    this.name = 'SearchError';
  }
}

export function createErrorHandler(toolName) {
  return async (operation, errorMessage = `${toolName} failed`) => {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }
      throw new ToolError(`${errorMessage}: ${error.message}`);
    }
  };
}

export function withErrorHandling(handler, toolName) {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      console.error(`Error in ${toolName}:`, error);

      if (error instanceof ValidationError) {
        return {
          content: [{ type: "text", text: `Validation Error: ${error.message}` }],
          isError: true
        };
      }

      if (error instanceof ExecutionError) {
        return {
          content: [{ type: "text", text: `Execution Error: ${error.message}` }],
          isError: true
        };
      }

      if (error instanceof SearchError) {
        return {
          content: [{ type: "text", text: `Search Error: ${error.message}` }],
          isError: true
        };
      }

      return {
        content: [{ type: "text", text: `${TOOL_STRINGS.ERROR_PREFIX} ${error.message}` }],
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
  return withErrorHandling(
    async (args) => {
      // Validate parameters here if needed
      return args;
    },
    toolName
  );
}