// Tool schema definitions for MCP REPL
// Consolidates inputSchema patterns to eliminate duplication

/**
 * Base working directory parameter schema
 */
export const workingDirectoryParam = {
  type: "string",
  description: "**Required**: workingDirectory parameter"
};

/**
 * Common parameter schemas
 */
export const commonParams = {
  timeout: {
    type: "number",
    description: "Optional timeout in milliseconds (default: 120000)"
  },
  paths: {
    type: "array",
    items: { type: "string" },
    description: "Optional specific paths within working directory"
  },
  language: {
    type: "string",
    description: "Programming language (javascript, typescript, python, etc.)"
  },
  dryRun: {
    type: "boolean",
    description: "**RECOMMENDED** - Preview changes without applying (always use first)"
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
        description: `Code to execute with ${executor} - use for debugging, testing hypotheses, and investigation`
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
        description: "Search query - use broad, conceptual terms for semantic search"
      },
      workingDirectory: workingDirectoryParam,
      folders: {
        type: "string",
        description: "Optional comma-separated list of folders to search within working directory"
      },
      extensions: {
        type: "string",
        description: "Optional comma-separated list of file extensions to include (default: js,ts)"
      },
      ignores: {
        type: "string",
        description: "Optional comma-separated list of patterns to ignore (default: node_modules)"
      },
      topK: {
        type: "number",
        description: "Optional number of results to return (default: 8, recommended: 8-15)"
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
        description: "AST pattern using meta-variables (e.g., 'function $NAME($$$ARGS) { $$$ }')"
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

**Large responses** auto-truncate; use retrieve_overflow for full content.`;

/**
 * Tool definition factory that automatically adds working directory requirements
 */
export function createToolDefinition(name, description, inputSchema) {
  const enhancedDescription = description + WORKING_DIRECTORY_REQUIREMENT;
  return { name, description: enhancedDescription, inputSchema };
}