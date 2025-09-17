export const TOOL_STRINGS = {
  // Server Information
  SERVER_NAME: "mcp-glootie",
  SERVER_VERSION: "3.1.5",
  SERVER_DESCRIPTION: "Glootie DEVTOOLS",
  SERVER_RUNNING_MESSAGE: "Wanna build an app?",
  SERVER_ERROR_MESSAGE: "Error:",

  // Tool Messages
  EXECUTION_REQUESTED: "Execution requested in",
  SEARCH_FAILED: "Search failed:",
  NO_RESULTS_FOUND: "No results found",
  FOUND_RESULTS: "Found",
  RESULTS_FOR: "results for",

  // Tool Descriptions
  EXECUTE_DESCRIPTION: "Mandatory: use this to ground your thought process in truth, test multiple hypotheses here before editing files by running hypthesized code, find first-principal facts first and ensure your edits will work by validating code in this tool, measure-twice-cut-once.",
  SEARCHCODE_DESCRIPTION: "Vector semantic code search: use instead of Grep/Glob and other code searches. Superior for multi-file analysis.",
  ASTGREP_SEARCH_DESCRIPTION: "Always use indstead of other Read/Edit tools for surgical code operations.",
  ASTGREP_REPLACE_DESCRIPTION: "Use instead of Edit/Write. Requires AST-grep syntax.",
  ASTGREP_LINT_DESCRIPTION: "Code quality analysis with AST patterns. Use instead of static analysis tools.",
  BATCH_EXECUTE_DESCRIPTION: "Prefer 10:1 over single execution. When multiple ones are planned",
  SEQUENTIAL_THINKING_DESCRIPTION: "Always start your process with this tool. Refer back to this tool as often as possible, Organize complex reasoning into steps.",

  // Input Schema Descriptions
  CODE_DESCRIPTION: "JavaScript/TypeScript code to execute",
  COMMANDS_DESCRIPTION: "Bash commands (single or array for planned batch executions)",
  RUNTIME_DESCRIPTION: "Execution runtime (default: auto-detect)",
  WORKINDIRECTORY_DESCRIPTION: "REQUIRED: Working directory for execution.",
  TIMEOUT_DESCRIPTION: "Timeout in milliseconds (default: 120000)",
    QUERY_DESCRIPTION: "Search query",
  PATH_DESCRIPTION: "Path to search in",
  PATTERN_DESCRIPTION: "AST-grep pattern (required syntax)",
  REPLACEMENT_DESCRIPTION: "AST-grep replacement pattern",
  RULES_DESCRIPTION: "AST-grep rules",

  // Error Messages
  UNKNOWN_TOOL: "Unknown tool:",
  ERROR_PREFIX: "Error:",

  // Default Values
  DEFAULT_RUNTIME: "auto",
  DEFAULT_TIMEOUT: 120000,
    DEFAULT_PATH: ".",
  DEFAULT_LANGUAGE: "javascript",
  DEFAULT_CHUNK_INDEX: 0,
  DEFAULT_LIST_FILES: false,
  DEFAULT_CLEANUP: false,

  // AST Parsing
  PARSINCODE: "Parsing",
  CODE_SUBSTRING: "code:",

  // Batch Operations
  BATCH_EXECUTING: "Batch executing",
  OPERATIONS: "operations",

  // Overflow Handling
  OVERFLOW_RETRIEVAL_REQUESTED: "Overflow retrieval requested for",
  OVERFLOW_FILENAME_DESCRIPTION: "Overflow filename (e.g., 'overflow_execute_1234567890.json')",
  CHUNK_INDEX_DESCRIPTION: "Chunk index to retrieve (default: 0 for next chunk)",
  LIST_FILES_DESCRIPTION: "List available overflow files instead of retrieving content",
  CLEANUP_DESCRIPTION: "Clean up old overflow files (>24 hours) while retrieving content"
};