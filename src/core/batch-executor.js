// Optimized batch execution with parallel processing and better error handling
const MAX_CONCURRENT_OPERATIONS = 5; // Limit concurrency to avoid overwhelming the system

export async function executeBatch(operations, toolHandlers, workingDir) {
  const startTime = Date.now();

  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      success: false,
      error: "Operations must be a non-empty array",
      executionTimeMs: Date.now() - startTime,
      turnReductionHint: "Provide at least one operation to execute"
    };
  }

  // Optimized validation with early termination
  const validation = validateOperationsEarly(operations, toolHandlers);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      executionTimeMs: Date.now() - startTime,
      turnReductionHint: validation.turnReductionHint
    };
  }

  // Validate tool requirements
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

  // Execute operations in parallel batches for better performance
  const results = await executeOperationsInParallel(operations, toolHandlers, workingDir);

  const executionTimeMs = Date.now() - startTime;
  const successfulOperations = results.filter(r => r.success).length;
  const failedOperations = results.filter(r => !r.success).length;
  const successRate = successfulOperations / operations.length;

  return {
    success: true,
    totalOperations: operations.length,
    successfulOperations,
    failedOperations,
    successRate,
    executionTimeMs,
    turnReductionMetrics: {
      potentialTurnsSaved: operations.length - 1,
      operationsPerTurn: operations.length,
      efficiency: successRate === 1 ? 'optimal' : successRate > 0.8 ? 'good' : 'needs_improvement'
    },
    results
  };
}

// Optimized early validation with single pass
function validateOperationsEarly(operations, toolHandlers) {
  const unknownTools = [];
  const invalidOperations = [];
  const availableTools = new Set(Object.keys(toolHandlers));

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];

    if (!op.tool || typeof op.tool !== 'string') {
      invalidOperations.push(i);
    } else if (!availableTools.has(op.tool)) {
      unknownTools.push({ operation: i, tool: op.tool });
    } else if (!op.arguments || typeof op.arguments !== 'object') {
      invalidOperations.push(i);
    }

    // Early termination if we have both types of errors
    if (unknownTools.length > 0 && invalidOperations.length > 0 && i > 10) {
      break;
    }
  }

  if (unknownTools.length > 0 || invalidOperations.length > 0) {
    const errorMessages = [];
    if (unknownTools.length > 0) {
      errorMessages.push(`Unknown tools: ${unknownTools.map(t => `${t.tool} (operation ${t.operation})`).join(', ')}`);
      errorMessages.push(`Available tools: ${Array.from(availableTools).join(', ')}`);
    }
    if (invalidOperations.length > 0) {
      errorMessages.push(`Invalid operations at indices: ${invalidOperations.join(', ')}`);
    }

    return {
      valid: false,
      error: errorMessages.join('. '),
      turnReductionHint: "Check tool names and ensure each operation has a valid arguments object"
    };
  }

  return { valid: true };
}

// Execute operations in parallel batches for optimal performance
async function executeOperationsInParallel(operations, toolHandlers, workingDir) {
  const results = [];

  for (let i = 0; i < operations.length; i += MAX_CONCURRENT_OPERATIONS) {
    const batch = operations.slice(i, i + MAX_CONCURRENT_OPERATIONS);
    const batchPromises = batch.map(async (operation, index) => {
      const operationIndex = i + index;
      const operationStartTime = Date.now();

      try {
        const params = {
          ...operation.arguments,
          workingDirectory: operation.arguments.workingDirectory || workingDir
        };

        const handler = toolHandlers[operation.tool];
        const result = await handler(params);

        return {
          operation: operationIndex,
          tool: operation.tool,
          success: true,
          content: result.content,
          executionTimeMs: Date.now() - operationStartTime
        };
      } catch (error) {
        return {
          operation: operationIndex,
          tool: operation.tool,
          success: false,
          error: error.message,
          executionTimeMs: Date.now() - operationStartTime
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// Optimized validation with cached tool requirements and efficient error aggregation
const TOOL_REQUIREMENTS = new Map([
  ['f', new Set(['code'])],
  ['executedeno', new Set(['code'])],
  ['executebash', new Set()],
  ['searchcode', new Set(['query'])],
  ['astgrep_search', new Set(['pattern'])],
  ['astgrep_replace', new Set(['pattern', 'replacement'])],
  ['astgrep_lint', new Set(['rules'])],
  ['astgrep_analyze', new Set(['pattern'])],
  ['astgrep_enhanced_search', new Set(['pattern'])],
  ['astgrep_multi_pattern', new Set(['patterns'])],
  ['astgrep_constraint_search', new Set(['pattern'])],
  ['astgrep_project_init', new Set(['language'])],
  ['astgrep_project_scan', new Set()],
  ['astgrep_test', new Set(['pattern'])],
  ['astgrep_validate_rules', new Set(['rules'])],
  ['astgrep_deburule', new Set(['pattern'])],
  ['sequentialthinking', new Set(['thoughts'])]
]);

export function validateBatchOperations(operations) {
  const validationErrors = [];

  // Single pass validation with early termination for common errors
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const requirements = TOOL_REQUIREMENTS.get(op.tool);

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
    // Optimized error aggregation using Map for better performance
    const byTool = new Map();
    validationErrors.forEach(error => {
      if (!byTool.has(error.tool)) byTool.set(error.tool, []);
      byTool.get(error.tool).push(error);
    });

    const summary = Array.from(byTool.entries())
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