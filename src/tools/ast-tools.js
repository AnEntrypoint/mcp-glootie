// Basic search and AST tools for MCP Glootie

import { searchCode } from '../vector-search.js';
import { TOOL_STRINGS } from '../constants/tool-strings.js';
import {
  formatSearchResults,
  createToolHandler,
  validateRequiredParams,
  createErrorResponse,
  formatASTSearchMessage,
  formatASTReplaceMessage,
  formatASTLintMessage,
  formatBatchOperationMessage,
  formatCodeParsingMessage
} from '../utils/tool-utils.js';

export const searchTools = [
  {
    name: "searchcode",
    description: TOOL_STRINGS.SEARCHCODE_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: TOOL_STRINGS.QUERY_DESCRIPTION },
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["query", "workingDirectory"]
    },
    handler: createToolHandler(async ({ query, path = TOOL_STRINGS.DEFAULT_PATH, workingDirectory }) => {
      validateRequiredParams({ query, workingDirectory }, ['query', 'workingDirectory']);
      const results = await searchCode(query, workingDirectory, [path]);
      return formatSearchResults(results, query, path);
    })
  }
];

export const astTools = [
  {
    name: "parse_ast",
    description: "Parse AST from code",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: TOOL_STRINGS.CODE_DESCRIPTION },
        language: { type: "string", description: "Programming language" },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["code", "workingDirectory"]
    },
    handler: createToolHandler(async ({ code, language = TOOL_STRINGS.DEFAULT_LANGUAGE, workingDirectory }) => {
      validateRequiredParams({ code, workingDirectory }, ['code', 'workingDirectory']);
      return formatCodeParsingMessage(language, code);
    })
  }
];

export const enhancedAstTools = [
  {
    name: "astgrep_search",
    description: TOOL_STRINGS.ASTGREP_SEARCH_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: TOOL_STRINGS.PATTERN_DESCRIPTION },
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["pattern", "workingDirectory"]
    },
    handler: createToolHandler(async ({ pattern, path = TOOL_STRINGS.DEFAULT_PATH, workingDirectory }) => {
      validateRequiredParams({ pattern, workingDirectory }, ['pattern', 'workingDirectory']);
      return formatASTSearchMessage(pattern, path);
    })
  },
  {
    name: "astgrep_replace",
    description: TOOL_STRINGS.ASTGREP_REPLACE_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: TOOL_STRINGS.PATTERN_DESCRIPTION },
        replacement: { type: "string", description: TOOL_STRINGS.REPLACEMENT_DESCRIPTION },
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["pattern", "replacement", "path", "workingDirectory"]
    },
    handler: createToolHandler(async ({ pattern, replacement, path, workingDirectory }) => {
      validateRequiredParams({ pattern, replacement, path, workingDirectory }, ['pattern', 'replacement', 'path', 'workingDirectory']);
      return formatASTReplaceMessage(pattern, replacement, path);
    })
  },
  {
    name: "astgrep_lint",
    description: TOOL_STRINGS.ASTGREP_LINT_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        rules: { type: "array", description: TOOL_STRINGS.RULES_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["path", "workingDirectory"]
    },
    handler: createToolHandler(async ({ path, rules = [], workingDirectory }) => {
      validateRequiredParams({ path, workingDirectory }, ['path', 'workingDirectory']);
      return formatASTLintMessage(path);
    })
  }
];
export const batchTools = [
  {
    name: "batch_execute",
    description: TOOL_STRINGS.BATCH_EXECUTE_DESCRIPTION,
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
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["operations", "workingDirectory"]
    },
    handler: createToolHandler(async ({ operations, workingDirectory }) => {
      validateRequiredParams({ operations, workingDirectory }, ['operations', 'workingDirectory']);
      return formatBatchOperationMessage(operations);
    })
  }
];
import { handleSequentialThinking } from '../core/thinking-handler.js';

export const thinkingTools = [
  {
    name: "sequentialthinking",
    description: TOOL_STRINGS.SEQUENTIAL_THINKING_DESCRIPTION,
    inputSchema: {
      type: "object",
      properties: {
        thoughts: {
          type: ["string", "array"],
          items: {
            type: "string",
            minLength: 1
          },
          minLength: 1,
          description: "Single thought (string) or multiple thoughts (array of strings) to process"
        },
        workingDirectory: {
          type: "string",
          description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION
        },
        parentId: {
          type: "string",
          description: "Optional - parent thought ID for creating thought chains"
        }
      },
      required: ["thoughts", "workingDirectory"]
    },
    handler: handleSequentialThinking
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
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["query", "workingDirectory"]
    },
    handler: createToolHandler(async ({ query, path = TOOL_STRINGS.DEFAULT_PATH, workingDirectory }) => {
      validateRequiredParams({ query, workingDirectory }, ['query', 'workingDirectory']);
      const results = await searchCode(query, workingDirectory, [path]);
      return results.length > 0
        ? `Found ${results.length} semantic results for "${query}" in ${path}:\n\n${results.map(r => `${r.file}:${r.startLine}-${r.endLine}\n${r.content.substring(0, 200)}...\nScore: ${r.score.toFixed(3)}`).join('\n\n')}`
        : `No semantic results found for "${query}" in ${path}`;
    })
  }
];