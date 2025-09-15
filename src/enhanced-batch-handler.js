// Enhanced batch handler with natural language support
// Simplifies batch operations by accepting natural language descriptions

import { handleBatchExecute } from './batch-handler.js';
import { getRecommendedTools } from './task-complexity-detector.js';

/**
 * Enhanced batch handler that supports both structured operations and natural language
 * @param {Object} args - Tool arguments
 * @param {string} workingDir - Working directory
 * @param {Function} getToolHandlers - Function to get tool handlers
 * @returns {Object} MCP tool response
 */
export async function handleEnhancedBatchExecute(args, workingDir, getToolHandlers) {
  try {
    const { operations, description, task } = args;

    // If natural language description is provided, convert to operations
    if ((description || task) && !operations) {
      const naturalLanguageTask = description || task;
      const generatedOperations = await generateOperationsFromNaturalLanguage(naturalLanguageTask, workingDir);

      return await executeBatchWithOperations(generatedOperations, workingDir, getToolHandlers, naturalLanguageTask);
    }

    // If structured operations are provided, use them directly
    if (operations) {
      return await handleBatchExecute(args, workingDir, getToolHandlers);
    }

    // If neither is provided, return helpful error
    return {
      content: [
        {
          type: 'text',
          text: `Enhanced Batch Execution Tool

Please provide either:
1. A natural language description of what you want to accomplish, or
2. A structured operations array

Examples:
• "Add a utility function and analyze the existing code structure"
• "Search for all functions and create a summary report"
• "Create a new component and update the imports"

Or use the structured format:
{
  "operations": [
    {"tool": "searchcode", "arguments": {...}},
    {"tool": "astgrep_search", "arguments": {...}}
  ]
}`
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `ENHANCED BATCH EXECUTION ERROR: ${error.message}`
        }
      ]
    };
  }
}

/**
 * Generate operations from natural language description
 * @param {string} description - Natural language task description
 * @param {string} workingDir - Working directory
 * @returns {Array} Generated operations array
 */
async function generateOperationsFromNaturalLanguage(description, workingDir) {
  // Get tool recommendations based on task complexity
  const recommendations = getRecommendedTools(description, workingDir);

  const operations = [];
  const lowerDesc = description.toLowerCase();

  // Common task patterns and their corresponding operations
  const taskPatterns = [
    {
      pattern: ['search', 'find', 'analyze', 'explore'],
      operations: [
        { tool: 'searchcode', priority: 1 },
        { tool: 'astgrep_search', priority: 2 }
      ]
    },
    {
      pattern: ['create', 'add', 'write', 'make'],
      operations: [
        { tool: 'Write', priority: 1 },
        { tool: 'Edit', priority: 2 }
      ]
    },
    {
      pattern: ['read', 'examine', 'look at', 'check'],
      operations: [
        { tool: 'Read', priority: 1 },
        { tool: 'searchcode', priority: 2 }
      ]
    },
    {
      pattern: ['transform', 'replace', 'refactor', 'change'],
      operations: [
        { tool: 'astgrep_replace', priority: 1 },
        { tool: 'Edit', priority: 2 }
      ]
    },
    {
      pattern: ['validate', 'lint', 'check quality'],
      operations: [
        { tool: 'astgrep_lint', priority: 1 },
        { tool: 'astgrep_analyze', priority: 2 }
      ]
    },
    {
      pattern: ['batch', 'multiple', 'several', 'all'],
      operations: [
        { tool: 'batch_execute', priority: 1 }
      ]
    }
  ];

  // Find matching patterns and generate operations
  const matchedPatterns = taskPatterns.filter(tp =>
    tp.pattern.some(pattern => lowerDesc.includes(pattern))
  );

  // Sort matched patterns by priority and relevance
  matchedPatterns.sort((a, b) => {
    const aScore = a.pattern.reduce((sum, pattern) =>
      sum + (lowerDesc.split(pattern).length - 1), 0);
    const bScore = b.pattern.reduce((sum, pattern) =>
      sum + (lowerDesc.split(pattern).length - 1), 0);
    return bScore - aScore;
  });

  // Generate operations from matched patterns
  matchedPatterns.slice(0, 3).forEach(patternGroup => {
    patternGroup.operations.forEach(op => {
      if (!operations.find(existing => existing.tool === op.tool)) {
        const operation = {
          tool: op.tool,
          arguments: generateToolArguments(op.tool, description, workingDir)
        };
        operations.push(operation);
      }
    });
  });

  // If no patterns matched, use recommended tools
  if (operations.length === 0 && recommendations.recommendedTools) {
    recommendations.recommendedTools.slice(0, 3).forEach(toolName => {
      const operation = {
        tool: toolName,
        arguments: generateToolArguments(toolName, description, workingDir)
      };
      operations.push(operation);
    });
  }

  return operations;
}

/**
 * Generate appropriate arguments for each tool based on the description
 * @param {string} toolName - Name of the tool
 * @param {string} description - Natural language description
 * @param {string} workingDir - Working directory
 * @returns {Object} Tool-specific arguments
 */
function generateToolArguments(toolName, description, workingDir) {
  const baseArgs = { workingDirectory: workingDir };

  switch (toolName) {
    case 'searchcode':
      return {
        ...baseArgs,
        query: extractSearchTerm(description) || 'function',
        type: 'semantic'
      };

    case 'astgrep_search':
      return {
        ...baseArgs,
        pattern: extractPattern(description) || 'function $NAME($$$ARGS) { $$$ }',
        context: 3
      };

    case 'Write':
      return {
        ...baseArgs,
        filePath: extractFilePath(description) || './new-file.js',
        content: extractContent(description) || '// Generated content\n'
      };

    case 'Read':
      return {
        ...baseArgs,
        filePath: extractFilePath(description) || './README.md'
      };

    case 'Edit':
      return {
        ...baseArgs,
        filePath: extractFilePath(description) || './existing-file.js',
        oldString: extractOldString(description) || '// old content',
        newString: extractNewString(description) || '// new content'
      };

    case 'astgrep_replace':
      return {
        ...baseArgs,
        pattern: extractPattern(description) || 'console.log($$)',
        replacement: extractReplacement(description) || 'logger.info($$)',
        dryRun: true
      };

    case 'astgrep_lint':
      return {
        ...baseArgs,
        rules: extractRules(description) || 'id: no-console\nmessage: Avoid console.log\npattern: console.log($$)',
        severity: 'warning'
      };

    default:
      return baseArgs;
  }
}

/**
 * Helper functions to extract information from natural language
 */
function extractSearchTerm(description) {
  const terms = description.match(/search for ["']([^"']+)["']/i);
  return terms ? terms[1] : null;
}

function extractPattern(description) {
  const patterns = description.match(/pattern ["']([^"']+)["']/i);
  return patterns ? patterns[1] : null;
}

function extractFilePath(description) {
  const paths = description.match(/file ["']([^"']+)["']/i);
  return paths ? paths[1] : null;
}

function extractContent(description) {
  const content = description.match(/content ["']([^"']+)["']/i);
  return content ? content[1] : null;
}

function extractOldString(description) {
  const oldStr = description.match(/old ["']([^"']+)["']/i);
  return oldStr ? oldStr[1] : null;
}

function extractNewString(description) {
  const newStr = description.match(/new ["']([^"']+)["']/i);
  return newStr ? newStr[1] : null;
}

function extractReplacement(description) {
  const replacement = description.match(/replace with ["']([^"']+)["']/i);
  return replacement ? replacement[1] : null;
}

function extractRules(description) {
  const rules = description.match(/rules ["']([^"']+)["']/i);
  return rules ? rules[1] : null;
}

/**
 * Execute operations with enhanced reporting
 * @param {Array} operations - Operations to execute
 * @param {string} workingDir - Working directory
 * @param {Function} getToolHandlers - Tool handlers function
 * @param {string} originalTask - Original natural language task
 * @returns {Object} Enhanced batch result
 */
async function executeBatchWithOperations(operations, workingDir, getToolHandlers, originalTask) {
  const startTime = Date.now();

  try {
    // Execute the batch operations
    const batchArgs = { operations };
    const result = await handleBatchExecute(batchArgs, workingDir, getToolHandlers);

    // Enhance the result with natural language context
    const enhancedContent = [
      {
        type: 'text',
        text: `Enhanced Batch Execution
Original Task: ${originalTask}
Generated Operations: ${operations.length}

${result.content[0].text}`
      }
    ];

    // Add the rest of the original content
    if (result.content.length > 1) {
      enhancedContent.push(...result.content.slice(1));
    }

    // Add natural language summary
    enhancedContent.push({
      type: 'text',
      text: generateNaturalLanguageSummary(originalTask, operations, result)
    });

    return {
      content: enhancedContent
    };

  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `ENHANCED BATCH EXECUTION FAILED: ${error.message}

The system tried to convert your natural language task into executable operations but encountered an error.

Try rephrasing your task or use the structured operations format instead.`
        }
      ]
    };
  }
}

/**
 * Generate a natural language summary of the batch execution
 * @param {string} originalTask - Original task description
 * @param {Array} operations - Operations that were executed
 * @param {Object} result - Batch execution result
 * @returns {string} Natural language summary
 */
function generateNaturalLanguageSummary(originalTask, operations, result) {
  const summaryLines = [`Task Summary: ${originalTask}`];

  const successfulOps = operations.filter((_, index) => {
    const resultContent = result.content[index + 1]; // +1 to skip header
    return resultContent && resultContent.text.includes('✓');
  }).length;

  summaryLines.push(`Completed: ${successfulOps}/${operations.length} operations`);

  if (successfulOps === operations.length) {
    summaryLines.push('Status: All operations completed successfully');
  } else {
    summaryLines.push('Status: Some operations encountered issues');
  }

  summaryLines.push('The system automatically selected and configured the appropriate tools based on your task description.');

  return summaryLines.join('\n');
}