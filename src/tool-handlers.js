// Tool execution handlers for MCP REPL server
// Consolidates all tool execution logic with consistent error handling

import { writeFileSync, unlinkSync } from 'fs';
import * as path from 'node:path';
import { createErrorResponse, createSuccessResponse, validateRequiredParams } from './common-errors.js';
import { validateWorkingDirectory } from './validation-utils.js';
import { applyTruncation } from './output-truncation.js';
import { executeNodeCode, executeDenoCode, executeBashCommands } from './process-executor.js';
import { handleRetrieveOverflow } from './overflow-handler.js';

/**
 * Handle Node.js code execution
 */
export async function handleNodeExecution(args, defaultWorkingDir) {
  const startTime = Date.now();
  
  const paramError = validateRequiredParams(args, ['code', 'workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }

  const result = await executeNodeCode(args.code, {
    workingDirectory: dirValidation.effectiveDir,
    timeout: args.timeout || 120000
  });

  return applyTruncation(result, dirValidation.effectiveDir, 'executenodejs');
}

/**
 * Handle Deno code execution
 */
export async function handleDenoExecution(args, defaultWorkingDir) {
  const startTime = Date.now();
  
  const paramError = validateRequiredParams(args, ['code', 'workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }

  const result = await executeDenoCode(args.code, {
    workingDirectory: dirValidation.effectiveDir,
    timeout: args.timeout || 120000
  });

  return applyTruncation(result, dirValidation.effectiveDir, 'executedeno');
}

/**
 * Handle bash command execution
 */
export async function handleBashExecution(args, defaultWorkingDir) {
  const startTime = Date.now();
  
  const paramError = validateRequiredParams(args, ['commands', 'workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }

  const result = await executeBashCommands(args.commands, {
    workingDirectory: dirValidation.effectiveDir,
    timeout: args.timeout || 120000
  });

  return applyTruncation(result, dirValidation.effectiveDir, 'executebash');
}

/**
 * Handle semantic code search
 */
export async function handleCodeSearch(args, defaultWorkingDir, getVectorIndexer) {
  const startTime = Date.now();
  
  const paramError = validateRequiredParams(args, ['query', 'workingDirectory'], startTime);
  if (paramError) return paramError;

  try {
    const { searchSemantic } = await getVectorIndexer();
    const results = await searchSemantic(args.query, args);
    return createSuccessResponse({ results }, startTime);
  } catch (error) {
    return createErrorResponse(error, startTime);
  }
}

/**
 * Create tool handlers map for delegation
 */
export function createToolHandlers(defaultWorkingDir, getVectorIndexer, getAstGrepUtils, getEnhancedUtils, getBatchHandler, getBashHandler) {
  return {
    executenodejs: (args) => handleNodeExecution(args, defaultWorkingDir),
    executedeno: (args) => handleDenoExecution(args, defaultWorkingDir),
    executebash: (args) => handleBashExecution(args, defaultWorkingDir),
    searchcode: (args) => handleCodeSearch(args, defaultWorkingDir, getVectorIndexer),
    
    // AST tools - delegate to existing handlers
    astgrep_search: async (args) => {
      const { astgrepHandlers } = await getAstGrepUtils();
      return astgrepHandlers.handleAstGrepSearch(args, defaultWorkingDir, getAstGrepUtils);
    },
    astgrep_replace: async (args) => {
      const { astgrepHandlers } = await getAstGrepUtils(); 
      return astgrepHandlers.handleAstGrepReplace(args, defaultWorkingDir, getAstGrepUtils);
    },
    astgrep_lint: async (args) => {
      const { astgrepHandlersAdvanced } = await getAstGrepUtils();
      return astgrepHandlersAdvanced.handleAstGrepLint(args, defaultWorkingDir, getAstGrepUtils);
    },
    astgrep_analyze: async (args) => {
      const { astgrepHandlersAdvanced } = await getAstGrepUtils();
      return astgrepHandlersAdvanced.handleAstGrepAnalyze(args, defaultWorkingDir, getAstGrepUtils);
    },

    // Enhanced AST tools - delegate to enhanced handlers
    astgrep_enhanced_search: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepEnhancedSearch(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_multi_pattern: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepMultiPatternSearch(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_constraint_search: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepConstraintSearch(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_project_init: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepProjectInit(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_project_scan: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepProjectScan(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_test: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepTest(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_validate_rules: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepValidateRules(args, defaultWorkingDir, getEnhancedUtils);
    },
    astgrep_debug_rule: async (args) => {
      const { astgrepEnhancedHandlers } = await getEnhancedUtils();
      return astgrepEnhancedHandlers.handleAstGrepDebugRule(args, defaultWorkingDir, getEnhancedUtils);
    },

    // Sequential thinking tool
    sequentialthinking: async (args) => {
      const { handleSequentialThinking } = await import('./thinking-handler.js');
      return handleSequentialThinking(args, defaultWorkingDir);
    },

    // Overflow content retrieval
    retrieve_overflow: (args) => handleRetrieveOverflow(args, defaultWorkingDir),

    // Batch execution
    batch_execute: async (args) => {
      const { handleBatchExecute } = await getBatchHandler();
      return handleBatchExecute(args, defaultWorkingDir, () => createToolHandlers(defaultWorkingDir, getVectorIndexer, getAstGrepUtils, getEnhancedUtils, getBatchHandler, getBashHandler));
    }
  };
}