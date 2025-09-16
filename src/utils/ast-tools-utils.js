import { createToolDefinition } from './tool-schemas.js';

export const thinkingTools = [
  createToolDefinition(
    "sequentialthinking",
    "Sequential thinking tool for complex task analysis. Use to organize requirements, tool selection, and insights. Helpful for structured planning of complex tasks.",
    {
      type: "object",
      properties: {
        thoughts: {
          type: ["string", "array"],
          items: { type: "string", minLength: 1 },
          minLength: 1
        },
        workingDirectory: {
          type: "string",
          description: "Required - working directory for storing thought data locally"
        },
        parentId: {
          type: "string",
          description: "Optional - parent thought ID for creating thought chains"
        }
      },
      required: ["thoughts", "workingDirectory"]
    }
  )
];