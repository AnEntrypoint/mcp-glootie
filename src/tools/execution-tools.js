

import { createExecutionSchema, createToolDefinition } from './tool-schemas.js';

export const executionTools = [
  createToolDefinition(
    "execute",
    "PREFERRED: Always test code hypotheses first before editing files. MANDATORY workingDirectory for concurrent processing. Break problems into sections. Use for ground truth before file changes.",
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
          description: "REQUIRED: Working directory for execution. Specify for concurrent multi-directory processing."
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
      required: ["workingDirectory"]
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