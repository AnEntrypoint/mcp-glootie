// Batch handler for MCP tool orchestration
// Integrates with the main server to handle batch_execute tool calls

import { executeBatch, validateBatchOperations } from './batch-executor.js';

/**
 * Handles batch_execute MCP tool requests
 * @param {Object} args - Tool arguments containing operations array
 * @param {string} workingDir - Default working directory
 * @param {Function} getToolHandlers - Function to get available tool handlers
 * @returns {Object} MCP tool response with consolidated results
 */
export async function handleBatchExecute(args, workingDir, getToolHandlers) {
  const startTime = Date.now();
  
  try {
    const { operations } = args;
    
    // Validate operations parameter
    if (!operations) {
      throw new Error("Missing 'operations' parameter for batch_execute tool");
    }

    if (!Array.isArray(operations)) {
      throw new Error("'operations' parameter must be an array");
    }

    if (operations.length === 0) {
      throw new Error("'operations' array cannot be empty");
    }

    // Validate operation structure and requirements
    const validation = validateBatchOperations(operations);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Get tool handlers from the main server
    const toolHandlers = await getToolHandlers();

    // Execute batch operations
    const batchResult = await executeBatch(operations, toolHandlers, workingDir);

    // Format response content
    const contentLines = [];

    // Add batch summary header
    contentLines.push({
      type: 'text',
      text: `Batch Execution Summary:
Total operations: ${batchResult.totalOperations}
Successful: ${batchResult.successfulOperations}
Failed: ${batchResult.failedOperations}
Total execution time: ${batchResult.executionTimeMs}ms`
    });

    // Add detailed results for each operation
    if (batchResult.results && Array.isArray(batchResult.results)) {
      for (const result of batchResult.results) {
      const status = result.success ? '✓' : '✗';
      const header = `${status} Operation ${result.operation}: ${result.tool} (${result.executionTimeMs}ms)`;
      
      if (result.success && result.content) {
        // Extract text content from MCP content array
        const textContent = result.content
          .filter(c => c.type === 'text')
          .map(c => c.text)
          .join('\n');
        
        contentLines.push({
          type: 'text',
          text: `${header}\n${textContent}`
        });
      } else if (!result.success) {
        contentLines.push({
          type: 'text',
          text: `${header}\nERROR: ${result.error}`
        });
      }
    }
    }

    return {
      content: contentLines
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `BATCH EXECUTION ERROR: ${error.message}`
        }
      ]
    };
  }
}