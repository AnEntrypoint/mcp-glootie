// MCP Glootie Tools - Clean, simple implementation
export const tools = [
  {
    name: "searchcode",
    description: "Find code patterns and functions across the codebase",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        workingDirectory: { type: "string", description: "Directory to search" }
      },
      required: ["query"]
    }
  },
  {
    name: "astgrep_search",
    description: "Search for structural code patterns using AST matching",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "AST pattern to match" },
        context: { type: "number", description: "Context lines (default: 3)" },
        workingDirectory: { type: "string", description: "Directory to search" }
      },
      required: ["pattern"]
    }
  },
  {
    name: "astgrep_replace",
    description: "Transform code patterns safely with AST-based replacement",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Pattern to find" },
        replacement: { type: "string", description: "Replacement pattern" },
        dryRun: { type: "boolean", description: "Preview changes without applying" },
        workingDirectory: { type: "string", description: "Directory to process" }
      },
      required: ["pattern", "replacement"]
    }
  },
  {
    name: "batch_execute",
    description: "Execute multiple tools in a single coordinated operation",
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tool: { type: "string" },
              arguments: { type: "object" }
            },
            required: ["tool", "arguments"]
          }
        },
        workingDirectory: { type: "string" }
      },
      required: ["operations", "workingDirectory"]
    }
  },
  {
    name: "sequentialthinking",
    description: "Structure and analyze complex thoughts systematically",
    inputSchema: {
      type: "object",
      properties: {
        thoughts: {
          type: ["string", "array"],
          items: { type: "string" }
        },
        workingDirectory: { type: "string" }
      },
      required: ["thoughts", "workingDirectory"]
    }
  }
];

export function getToolList() {
  return tools;
}

export function getTool(name) {
  return tools.find(tool => tool.name === name);
}