// Execution tool definitions
// Node.js, Deno, and Bash execution tool schemas

import { createExecutionSchema, createToolDefinition } from './tool-schemas.js';

export const executionTools = [
  createToolDefinition(
    "executenodejs",
    "Node.js execution - USE FIRST for testing/debugging",
    createExecutionSchema("Node.js")
  ),
  
  createToolDefinition(
    "executedeno", 
    "Deno execution - USE FOR TypeScript/type-safe ops",
    createExecutionSchema("Deno")
  ),

  createToolDefinition(
    "executebash",
    "Bash command execution",
    {
      type: "object",
      properties: {
        commands: {
          type: ["string", "array"],
          description: "Command(s) - single or array for batch"
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
    "Retrieve truncated content (>25k tokens) - SPECIFY WORKING DIRECTORY",
    {
      type: "object",
      properties: {
        overflowFile: {
          type: "string",
          description: "Overflow filename (e.g., 'overflow_executenodejs_1234567890.json')"
        },
        workingDirectory: {
          type: "string",
          description: "**REQUIRED** - Working directory where overflow file is stored (same as original tool call)"
        },
        chunkIndex: {
          type: "number",
          description: "Optional chunk index to retrieve (default: 0 for next chunk). Use metadata from previous call to get subsequent chunks."
        },
        listFiles: {
          type: "boolean",
          description: "Optional: List all available overflow files instead of retrieving content"
        },
        cleanup: {
          type: "boolean", 
          description: "Optional: Clean up old overflow files (>24 hours) in addition to retrieving content"
        }
      },
      required: ["workingDirectory"],
      additionalProperties: false
    }
  )
];