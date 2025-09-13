// Batch executor for chaining multiple MCP tool calls
// Follows the project's convention over configuration and error propagation principles

/**
 * Executes multiple MCP tool operations in sequence with optimized turn reduction
 * @param {Array} operations - Array of {tool, parameters} objects
 * @param {Object} toolHandlers - Map of tool names to handler functions
 * @param {string} workingDir - Default working directory for operations
 * @returns {Object} Consolidated batch execution results with turn optimization metrics
 */
export async function executeBatch(operations, toolHandlers, workingDir) {
  const startTime = Date.now();

  // Fast validation for common patterns to reduce conversation turns
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      success: false,
      error: "Operations must be a non-empty array",
      executionTimeMs: Date.now() - startTime,
      turnReductionHint: "Provide at least one operation to execute"
    };
  }

  // Enhanced validation with turn reduction hints
  const unknownTools = [];
  const invalidOperations = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (!op.tool || typeof op.tool !== 'string') {
      invalidOperations.push(i);
    } else if (!toolHandlers[op.tool]) {
      unknownTools.push({ operation: i, tool: op.tool });
    } else if (!op.arguments || typeof op.arguments !== 'object') {
      invalidOperations.push(i);
    }
  }

  // Batch error reporting to reduce conversation turns
  if (unknownTools.length > 0 || invalidOperations.length > 0) {
    const errorMessages = [];
    if (unknownTools.length > 0) {
      errorMessages.push(`Unknown tools: ${unknownTools.map(t => `${t.tool} (operation ${t.operation})`).join(', ')}`);
      errorMessages.push(`Available tools: ${Object.keys(toolHandlers).join(', ')}`);
    }
    if (invalidOperations.length > 0) {
      errorMessages.push(`Invalid operations at indices: ${invalidOperations.join(', ')}`);
    }

    return {
      success: false,
      error: errorMessages.join('. '),
      executionTimeMs: Date.now() - startTime,
      turnReductionHint: "Check tool names and ensure each operation has a valid arguments object"
    };
  }

  const results = [];
  let successfulOperations = 0;
  let failedOperations = 0;

  // Pre-validate all operations before execution
  const validationResult = validateBatchOperations(operations);
  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.error,
      executionTimeMs: Date.now() - startTime,
      turnReductionHint: validationResult.turnReductionHint,
      validationDetails: validationResult.detailedErrors
    };
  }

  // Execute each operation in sequence
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const operationStartTime = Date.now();

    try {
      // Prepare parameters with working directory fallback
      const params = {
        ...operation.arguments,
        workingDirectory: operation.arguments.workingDirectory || workingDir
      };

      // Execute the tool
      const handler = toolHandlers[operation.tool];
      const result = await handler(params);

      const operationResult = {
        operation: i,
        tool: operation.tool,
        success: true,
        content: result.content,
        executionTimeMs: Date.now() - operationStartTime
      };

      results.push(operationResult);
      successfulOperations++;

    } catch (error) {
      const operationResult = {
        operation: i,
        tool: operation.tool,
        success: false,
        error: error.message,
        executionTimeMs: Date.now() - operationStartTime
      };

      results.push(operationResult);
      failedOperations++;
    }
  }

  const executionTimeMs = Date.now() - startTime;
  const successRate = successfulOperations / operations.length;

  return {
    success: true,
    totalOperations: operations.length,
    successfulOperations,
    failedOperations,
    successRate,
    executionTimeMs,
    turnReductionMetrics: {
      potentialTurnsSaved: operations.length - 1, // Each batch operation saves turns vs individual calls
      operationsPerTurn: operations.length,
      efficiency: successRate === 1 ? 'optimal' : successRate > 0.8 ? 'good' : 'needs_improvement'
    },
    results
  };
}

/**
 * Validates batch operation parameters with enhanced error reporting for turn reduction
 * @param {Array} operations - Operations to validate
 * @returns {Object} Validation result with batch error reporting
 */
export function validateBatchOperations(operations) {
  const toolRequirements = {
    executenodejs: ['code'],
    executedeno: ['code'],
    executebash: [],
    searchcode: ['query'],
    astgrep_search: ['pattern'],
    astgrep_replace: ['pattern', 'replacement'],
    astgrep_lint: ['rules'],
    astgrep_analyze: ['pattern'],
    astgrep_enhanced_search: ['pattern'],
    astgrep_multi_pattern: ['patterns'],
    astgrep_constraint_search: ['pattern'],
    astgrep_project_init: ['language'],
    astgrep_project_scan: [],
    astgrep_test: ['pattern'],
    astgrep_validate_rules: ['rules'],
    astgrep_debug_rule: ['pattern'],
    sequentialthinking: ['thoughts']
  };

  const validationErrors = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const requirements = toolRequirements[op.tool];

    if (requirements) {
      const missingParams = [];
      for (const req of requirements) {
        if (!op.arguments[req]) {
          missingParams.push(req);
        }
      }

      if (missingParams.length > 0) {
        validationErrors.push({
          operation: i,
          tool: op.tool,
          missing: missingParams,
          suggestion: `Operation ${i} (${op.tool}) requires: ${missingParams.join(', ')}`
        });
      }
    }
  }

  if (validationErrors.length > 0) {
    // Group by error type for better turn reduction
    const byTool = {};
    validationErrors.forEach(error => {
      if (!byTool[error.tool]) byTool[error.tool] = [];
      byTool[error.tool].push(error);
    });

    const summary = Object.entries(byTool)
      .map(([tool, errors]) => {
        const allMissing = [...new Set(errors.flatMap(e => e.missing))].join(', ');
        return `${tool}: needs ${allMissing} (${errors.length} operation${errors.length > 1 ? 's' : ''})`;
      })
      .join('; ');

    return {
      valid: false,
      error: `Batch validation failed. Summary: ${summary}`,
      detailedErrors: validationErrors,
      turnReductionHint: "Fix all missing parameters in a single update to reduce conversation turns"
    };
  }

  return {
    valid: true,
    turnReductionHint: "All operations are properly configured for batch execution"
  };
}