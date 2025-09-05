// Batch executor for chaining multiple MCP tool calls
// Follows the project's convention over configuration and error propagation principles

/**
 * Executes multiple MCP tool operations in sequence
 * @param {Array} operations - Array of {tool, parameters} objects
 * @param {Object} toolHandlers - Map of tool names to handler functions
 * @param {string} workingDir - Default working directory for operations
 * @returns {Object} Consolidated batch execution results
 */
export async function executeBatch(operations, toolHandlers, workingDir) {
  const startTime = Date.now();
  
  // Validate operations array
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      success: false,
      error: "Operations must be a non-empty array",
      executionTimeMs: Date.now() - startTime
    };
  }

  // Validate operations structure
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (!op.tool || typeof op.tool !== 'string') {
      return {
        success: false,
        error: `Operation ${i}: Missing or invalid tool name`,
        executionTimeMs: Date.now() - startTime
      };
    }
    if (!toolHandlers[op.tool]) {
      return {
        success: false,
        error: `Operation ${i}: Unknown tool '${op.tool}'`,
        executionTimeMs: Date.now() - startTime
      };
    }
    if (!op.parameters || typeof op.parameters !== 'object') {
      return {
        success: false,
        error: `Operation ${i}: Missing or invalid parameters object`,
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  const results = [];
  let successfulOperations = 0;
  let failedOperations = 0;

  // Execute each operation in sequence
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    const operationStartTime = Date.now();
    
    try {
      // Prepare parameters with working directory fallback
      const params = {
        ...operation.parameters,
        workingDirectory: operation.parameters.workingDirectory || workingDir
      };

      // Execute the tool
      const handler = toolHandlers[operation.tool];
      const result = await handler({
        params: { name: operation.tool, arguments: params }
      });

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

  return {
    success: true,
    totalOperations: operations.length,
    successfulOperations,
    failedOperations,
    executionTimeMs: Date.now() - startTime,
    results
  };
}

/**
 * Validates batch operation parameters according to tool requirements
 * @param {Array} operations - Operations to validate
 * @returns {Object} Validation result
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

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const requirements = toolRequirements[op.tool];
    
    if (requirements) {
      for (const req of requirements) {
        if (!op.parameters[req]) {
          return {
            valid: false,
            error: `Operation ${i} (${op.tool}): Missing required parameter '${req}'`
          };
        }
      }
    }
  }

  return { valid: true };
}