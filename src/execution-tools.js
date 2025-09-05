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
  )
];