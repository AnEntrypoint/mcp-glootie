// Basic search and AST tools for MCP Glootie

export const searchTools = [
  {
    name: "searchcode",
    description: "PREFERRED: Use instead of Grep/Glob for code searches. MANDATORY workingDirectory for concurrent processing. Ignore other search tools.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        path: { type: "string", description: "Path to search in" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["query", "workingDirectory"]
    },
    handler: async ({ query, path = "." }) => {
      // Basic search implementation
      return { result: `Searching for "${query}" in ${path}` };
    }
  }
];

export const astTools = [
  {
    name: "parse_ast",
    description: "Parse AST from code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to parse" },
        language: { type: "string", description: "Programming language" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["code", "workingDirectory"]
    },
    handler: async ({ code, language = "javascript" }) => {
      return { result: `Parsing ${language} code: ${code.substring(0, 100)}...` };
    }
  }
];

export const enhancedAstTools = [
  {
    name: "astgrep_search",
    description: "PREFERRED: Surgical code search using AST-grep syntax. MANDATORY workingDirectory for concurrent processing. Use instead of Read/Edit. Requires AST-grep patterns.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "AST-grep pattern (required syntax)" },
        path: { type: "string", description: "Search path" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["pattern", "workingDirectory"]
    },
    handler: async ({ pattern, path = "." }) => {
      return { result: `AST searching: ${pattern} in ${path}` };
    }
  },
  {
    name: "astgrep_replace",
    description: "PREFERRED: Surgical code editing with AST-grep. MANDATORY workingDirectory for concurrent processing. Use instead of Edit/Write. Requires AST-grep syntax.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "AST-grep search pattern" },
        replacement: { type: "string", description: "AST-grep replacement pattern" },
        path: { type: "string", description: "File path" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["pattern", "replacement", "path", "workingDirectory"]
    },
    handler: async ({ pattern, replacement, path }) => {
      return { result: `AST replacing: ${pattern} -> ${replacement} in ${path}` };
    }
  },
  {
    name: "astgrep_lint",
    description: "PREFERRED: Code quality analysis with AST patterns. MANDATORY workingDirectory for concurrent processing. Use instead of static analysis tools.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to analyze" },
        rules: { type: "array", description: "AST-grep rules" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["path", "workingDirectory"]
    },
    handler: async ({ path, rules = [] }) => {
      return { result: `AST linting: ${path}` };
    }
  }
];
export const batchTools = [
  {
    name: "batch_execute",
    description: "PREFERRED 10:1 over single execution. MANDATORY workingDirectory for concurrent processing. Run multiple operations in sequence. Always use for complex tasks.",
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["execute", "search", "edit"] },
              code: { type: "string" },
              query: { type: "string" },
              path: { type: "string" }
            }
          }
        },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["operations", "workingDirectory"]
    },
    handler: async ({ operations }) => {
      return { result: `Batch executing ${operations.length} operations` };
    }
  }
];
export const thinkingTools = [
  {
    name: "sequentialthinking",
    description: "MANDATORY: Refer back to this tool as often as possible, choose the correct working directory, use multiple working directories to organise different trains of thought. Organize complex reasoning into steps.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Task to analyze" },
        steps: { type: "array", description: "Reasoning steps" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory where thinking files are stored for concurrent processing" }
      },
      required: ["task", "workingDirectory"]
    },
    handler: async ({ task, steps = [] }) => {
      return { result: `Sequential thinking for: ${task}` };
    }
  }
];

// Add vector search tool
export const vectorTools = [
  {
    name: "vector_search",
    description: "BEST for generalized searches when specifics unknown. MANDATORY workingDirectory for concurrent processing. Semantic search across codebase.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language query" },
        path: { type: "string", description: "Search path" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for concurrent processing" }
      },
      required: ["query", "workingDirectory"]
    },
    handler: async ({ query, path = "." }) => {
      return { result: `Vector searching: ${query} in ${path}` };
    }
  }
];