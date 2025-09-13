// Execution tool definitions
// Node.js, Deno, and Bash execution tool schemas

import { createExecutionSchema, createToolDefinition } from './tool-schemas.js';

export const executionTools = [
  createToolDefinition(
    "executenodejs",
    "Execute JavaScript code with Node.js",
    createExecutionSchema("Node.js")
  ),

  createToolDefinition(
    "executedeno",
    "Execute TypeScript/JavaScript with Deno",
    createExecutionSchema("Deno")
  ),

  createToolDefinition(
    "executebash",
    "Execute bash commands",
    {
      type: "object",
      properties: {
        commands: {
          type: ["string", "array"],
          description: "Command(s) - single or array for batch execution"
        },
        workingDirectory: {
          type: "string",
          description: "Working directory"
        },
        timeout: {
          type: "number",
          description: "Timeout ms (default: 120000)"
        }
      },
      required: ["commands"]
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
          description: "Overflow filename (e.g., 'overflow_executenodejs_1234567890.json')"
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