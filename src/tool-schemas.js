// Tool schema definitions for MCP REPL
// Consolidates inputSchema patterns to eliminate duplication

/**
 * Base working directory parameter schema
 */
export const workingDirectoryParam = {
  type: "string",
  description: "Working directory path"
};

/**
 * Common parameter schemas
 */
export const commonParams = {
  timeout: {
    type: "number",
    description: "Timeout ms (default: 120000)"
  },
  paths: {
    type: "array",
    items: { type: "string" },
    description: "Specific target paths"
  },
  language: {
    type: "string",
    description: "Target language"
  },
  dryRun: {
    type: "boolean",
    description: "Preview mode (recommended)"
  }
};

/**
 * Code execution schema
 */
export function createExecutionSchema(executor, additionalProps = {}) {
  return {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: `${executor} execution target`
      },
      workingDirectory: workingDirectoryParam,
      timeout: commonParams.timeout,
      ...additionalProps
    },
    required: ["code", "workingDirectory"]
  };
}

/**
 * Search operation schema
 */
export function createSearchSchema(additionalProps = {}) {
  return {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Semantic search query"
      },
      workingDirectory: workingDirectoryParam,
      folders: {
        type: "string",
        description: "Target folders (comma-separated)"
      },
      extensions: {
        type: "string",
        description: "File extensions (default: js,ts)"
      },
      ignores: {
        type: "string",
        description: "Ignore patterns (default: node_modules)"
      },
      topK: {
        type: "number",
        description: "Result count (default: 6)"
      },
      ...additionalProps
    },
    required: ["query", "workingDirectory"]
  };
}

/**
 * AST operation schema
 */
export function createAstSchema(additionalProps = {}) {
  return {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "AST pattern with meta-vars (e.g., 'function $NAME($$$ARGS) { $$$ }')"
      },
      workingDirectory: workingDirectoryParam,
      language: commonParams.language,
      paths: commonParams.paths,
      ...additionalProps
    },
    required: ["pattern", "workingDirectory"]
  };
}

/**
 * Standard working directory requirement text for all tools
 */
const WORKING_DIRECTORY_REQUIREMENT = `

Results show: file_path:line_nums with matched text.`;

/**
 * Tool definition factory that automatically adds working directory requirements
 */
export function createToolDefinition(name, description, inputSchema) {
  return { name, description: description + WORKING_DIRECTORY_REQUIREMENT, inputSchema };
}