// Execution tool definitions
// Node.js, Deno, and Bash execution tool schemas

import { createExecutionSchema, createToolDefinition } from './tool-schemas.js';

export const executionTools = [
  createToolDefinition(
    "executenodejs",
    "**PRIMARY EXECUTION ENGINE** - Execute JavaScript code with Node.js. **ALWAYS USE THIS TOOL FIRST** for code testing, debugging, and investigation.",
    createExecutionSchema("Node.js")
  ),
  
  createToolDefinition(
    "executedeno", 
    "**TYPESCRIPT EXECUTION ENGINE** - Execute TypeScript/JavaScript with Deno runtime. **ALWAYS USE FOR TYPE-SAFE OPERATIONS** and when TypeScript validation is needed.",
    createExecutionSchema("Deno")
  ),

  createToolDefinition(
    "executebash",
    "**BASH COMMAND EXECUTOR** - Execute bash commands with security validation and comprehensive error handling.",
    {
      type: "object",
      properties: {
        commands: {
          type: ["string", "array"],
          description: "Bash command(s) to execute - single command or array for batch execution"
        },
        workingDirectory: {
          type: "string", 
          description: "**REQUIRED** - Working directory for bash execution"
        },
        timeout: {
          type: "number",
          description: "Optional timeout in milliseconds (default: 120000)"
        }
      },
      required: ["commands", "workingDirectory"]
    }
  ),

  createToolDefinition(
    "retrieve_overflow",
    "**OVERFLOW CONTENT RETRIEVAL** - Retrieve truncated content from overflow files when tool responses exceed 25k tokens. **ALWAYS SPECIFY WORKING DIRECTORY** for overflow access.",
    {
      type: "object",
      properties: {
        overflowFile: {
          type: "string",
          description: "Overflow filename from truncation notice (e.g., 'overflow_executenodejs_1234567890.json')"
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