// Execution tool definitions
// Node.js, Deno, and Bash execution tool schemas

import { createExecutionSchema, createToolDefinition } from './tool-schemas.js';

// Consolidated execution tools - Reduced from 4 to 2 essential tools
export const executionTools = [
  createToolDefinition(
    "execute",
    "Unified execution tool for Node.js, Deno, and Bash. Run JavaScript, TypeScript, or shell commands with intelligent runtime detection. Supports code analysis, batch operations, and overflow management.",
    {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "JavaScript/TypeScript code to execute"
        },
        commands: {
          type: ["string", "array"],
          description: "Bash commands (single or array for batch execution)"
        },
        runtime: {
          type: "string",
          enum: ["nodejs", "deno", "bash", "auto"],
          description: "Execution runtime (default: auto-detect)"
        },
        workingDirectory: {
          type: "string",
          description: "Working directory for execution"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 120000)"
        },
        handleOverflow: {
          type: "boolean",
          description: "Automatically handle large outputs with overflow files (default: true)"
        }
      },
      required: [],
      anyOf: [
        { required: ["code"] },
        { required: ["commands"] }
      ]
    }
  ),

  createToolDefinition(
    "retrieve_overflow",
    "Retrieve truncated content from previous tool calls",
    {
      type: "object",
      properties: {
        overflowFile: {
          type: "string",
          description: "Overflow filename (e.g., 'overflow_execute_1234567890.json')"
        },
        workingDirectory: {
          type: "string",
          description: "Required - working directory where overflow file is stored"
        },
        chunkIndex: {
          type: "number",
          description: "Chunk index to retrieve (default: 0 for next chunk)"
        },
        listFiles: {
          type: "boolean",
          description: "List available overflow files instead of retrieving content"
        },
        cleanup: {
          type: "boolean",
          description: "Clean up old overflow files (>24 hours) while retrieving content"
        }
      },
      required: ["workingDirectory"],
      additionalProperties: false
    }
  )
];