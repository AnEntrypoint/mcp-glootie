// Basic search and AST tools for MCP Glootie

import { searchCode } from '../vector-search.js';
import { TOOL_STRINGS } from '../constants/tool-strings.js';
import {
  formatSearchResults,
  createToolHandler,
  createTimeoutToolHandler,
  createRetryToolHandler,
  validateRequiredParams,
  createErrorResponse,
  formatASTSearchMessage,
  formatASTReplaceMessage,
  formatASTLintMessage,
  formatBatchOperationMessage,
  formatCodeParsingMessage,
  getDefaultIgnorePatterns
} from '../utils/tool-utils.js';
import fs from 'fs';
import path from 'path';

export const searchTools = [
  {
    name: "searchcode",
    description: "Enhanced search tool: Use 'semantic' for natural language/concept search, 'pattern' for exact matches. Replaces both vector_search and traditional searchcode.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: TOOL_STRINGS.QUERY_DESCRIPTION },
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION },
        searchType: {
          type: "string",
          enum: ["semantic", "pattern"],
          description: "Search type: 'semantic' for natural language/concept search, 'pattern' for exact pattern matching"
        }
      },
      required: ["query", "workingDirectory"]
    },
    handler: createTimeoutToolHandler(async ({ query, path = TOOL_STRINGS.DEFAULT_PATH, workingDirectory, searchType = "semantic" }) => {
      validateRequiredParams({ query, workingDirectory }, ['query', 'workingDirectory']);
      const results = await searchCode(query, workingDirectory, [path]);

      if (searchType === "semantic") {
        return results.length > 0
          ? `Found ${results.length} semantic results for "${query}" in ${path}:\n\n${results.map(r => `${r.file}:${r.startLine}-${r.endLine}\n${r.content.substring(0, 200)}...\nScore: ${r.score.toFixed(3)}`).join('\n\n')}`
          : `No semantic results found for "${query}" in ${path}`;
      } else {
        return formatSearchResults(results, query, path);
      }
    }, 'searchcode', 45000)
  }
];

export const astTools = [
  {
    name: "parse_ast",
    description: "Parse AST from code with comprehensive ignore filtering",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: TOOL_STRINGS.CODE_DESCRIPTION },
        language: { type: "string", description: "Programming language" },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION },
        filePath: { type: "string", description: "Optional file path for ignore pattern checking" }
      },
      required: ["code", "workingDirectory"]
    },
    handler: createToolHandler(async ({ code, language = TOOL_STRINGS.DEFAULT_LANGUAGE, workingDirectory, filePath }) => {
      validateRequiredParams({ code, workingDirectory }, ['code', 'workingDirectory']);

      // Apply ignore patterns if filePath is provided
      if (filePath) {
        const ignorePatterns = getDefaultIgnorePatterns(workingDirectory);
        const relativePath = path.relative(workingDirectory, filePath);

        // Check if file should be ignored
        const shouldIgnore = ignorePatterns.files?.some(pattern => {
          const globPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
          return new RegExp(globPattern).test(relativePath);
        });

        if (shouldIgnore) {
          return `File ${filePath} is ignored by default patterns`;
        }
      }

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
    description: "Code quality analysis with AST patterns and comprehensive ignore filtering",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: TOOL_STRINGS.PATH_DESCRIPTION },
        rules: { type: "array", description: TOOL_STRINGS.RULES_DESCRIPTION },
        workingDirectory: { type: "string", description: TOOL_STRINGS.WORKINDIRECTORY_DESCRIPTION }
      },
      required: ["path", "workingDirectory"]
    },
    handler: createToolHandler(async ({ path: targetPath, rules = [], workingDirectory }) => {
      validateRequiredParams({ path: targetPath, workingDirectory }, ['path', 'workingDirectory']);

      // Apply comprehensive ignore filtering
      const ignorePatterns = getDefaultIgnorePatterns(workingDirectory);
      const fullPath = path.resolve(workingDirectory, targetPath);

      // Check if it's a directory or file
      try {
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          // For directories, scan and filter files
          const filesToLint = [];
          const scanDir = (dir) => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
              const entryPath = path.join(dir, entry.name);
              const relativePath = path.relative(workingDirectory, entryPath);

              // Check against ignore patterns
              const shouldIgnore = ignorePatterns.files?.some(pattern => {
                const globPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
                return new RegExp(globPattern).test(relativePath);
              }) || ignorePatterns.directories?.includes(entry.name);

              if (!shouldIgnore) {
                if (entry.isDirectory()) {
                  scanDir(entryPath);
                } else if (entry.isFile() && ignorePatterns.extensions?.includes(path.extname(entry.name))) {
                  filesToLint.push(entryPath);
                }
              }
            }
          };

          scanDir(fullPath);
          return `AST linting directory: ${targetPath} (${filesToLint.length} files after filtering)`;
        } else {
          // For single files, check if it should be ignored
          const relativePath = path.relative(workingDirectory, fullPath);
          const shouldIgnore = ignorePatterns.files?.some(pattern => {
            const globPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
            return new RegExp(globPattern).test(relativePath);
          });

          if (shouldIgnore) {
            return `File ${targetPath} is ignored by default patterns`;
          }

          return formatASTLintMessage(targetPath);
        }
      } catch (error) {
        return `Error accessing path ${targetPath}: ${error.message}`;
      }
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
    handler: createRetryToolHandler(async ({ operations, workingDirectory }) => {
      validateRequiredParams({ operations, workingDirectory }, ['operations', 'workingDirectory']);
      return formatBatchOperationMessage(operations);
    }, 'batch_execute', 2)
  }
];
import { handleSequentialThinking } from '../core/thinking-handler.js';

export const thinkingTools = [
  {
    name: "sequentialthinking",
    description: "AUTHORIZATION REQUIRED: Organize complex reasoning into steps with branching, revisions, thought chains. Call before any other tools.",
    inputSchema: {
      type: "object",
      properties: {
        thoughts: {
          type: ["string", "array"],
          items: { type: "string", minLength: 1 },
          description: "Thoughts to process"
        },
        workingDirectory: {
          type: "string",
          description: "REQUIRED: Working directory for execution"
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

// Vector search functionality is now consolidated into the enhanced searchcode tool above