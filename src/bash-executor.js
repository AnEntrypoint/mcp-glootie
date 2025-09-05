// Bash executor for MCP REPL project
// Provides secure bash command execution with batching support and comprehensive error handling

import { validateWorkingDirectory } from './validation-utils.js';
import { createErrorResponse, createSuccessResponse, validateRequiredParams } from './common-errors.js';
import { executeBashCommands } from './process-executor.js';

/**
 * Execute a single bash command or batch of commands
 * @param {string|Array} commands - Single command string or array of commands for batching
 * @param {number} timeout - Command timeout in milliseconds
 * @param {string} workingDirectory - Required working directory for command execution
 * @param {string} defaultWorkingDir - Server's default working directory
 * @returns {Promise<Object>} Execution result with stdout, stderr, and metadata
 */
export async function executeBashCommand(commands, timeout = 120000, workingDirectory, defaultWorkingDir) {
  const startTime = Date.now();
  
  // Validate required parameters
  const paramError = validateRequiredParams({ workingDirectory }, ['workingDirectory'], startTime);
  if (paramError) return paramError;
  
  // Validate and resolve working directory
  const dirValidation = validateWorkingDirectory(workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }
  
  const effectiveWorkingDir = dirValidation.effectiveDir;
  
  // Handle both single commands and batched commands
  const commandArray = Array.isArray(commands) ? commands : [commands];
  
  // Validate commands
  const validationResult = validateBashCommands(commandArray);
  if (!validationResult.valid) {
    return createErrorResponse(validationResult.error, startTime);
  }
  
  // Use consolidated process executor
  const result = await executeBashCommands(commands, {
    workingDirectory: dirValidation.effectiveDir,
    timeout
  });

  return result;
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          executionTimeMs,
          commandCount: commandArray.length,
          workingDirectory: effectiveWorkingDir
        });
      });
      
      bashProcess.on('error', (err) => {
        resolve({
          success: false,
          error: `Bash execution error: ${err.message}`,
          executionTimeMs: Date.now() - startTime
        });
      });
      
      // Write the bash script to stdin and close
      bashProcess.stdin.write(bashScript);
      bashProcess.stdin.end();
    });
    
  } catch (error) {
    return {
      success: false,
      error: `Bash execution failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Validate bash commands for security and structure
 * @param {Array} commands - Array of command strings
 * @returns {Object} Validation result
 */
export function validateBashCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return {
      valid: false,
      error: "Commands must be a non-empty array"
    };
  }
  
  // Check each command
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    
    if (typeof command !== 'string') {
      return {
        valid: false,
        error: `Command ${i}: Must be a string`
      };
    }
    
    if (command.trim().length === 0) {
      return {
        valid: false,
        error: `Command ${i}: Cannot be empty or whitespace only`
      };
    }
    
    // Basic security validation - prevent obviously dangerous commands
    const dangerous = ['rm -rf /', 'sudo rm', 'format', 'mkfs', ':(){ :|:& };:', 'dd if=/dev/zero'];
    const lowerCommand = command.toLowerCase();
    
    for (const pattern of dangerous) {
      if (lowerCommand.includes(pattern)) {
        return {
          valid: false,
          error: `Command ${i}: Contains potentially dangerous pattern '${pattern}'`
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Create a bash script from command array with error handling and progress tracking
 * @param {Array} commands - Array of commands to execute
 * @returns {string} Bash script string
 */
function createBashScript(commands) {
  const scriptLines = [
    '#!/bin/bash',
    'set -e  # Exit on error',
    'set -o pipefail  # Exit on pipe failure',
    '',
    '# Bash command execution with progress tracking',
    'echo "=== BASH EXECUTION START ==="',
    `echo "Commands to execute: ${commands.length}"`,
    'echo "Working directory: $(pwd)"',
    'echo "Timestamp: $(date)"',
    'echo ""'
  ];
  
  // Add each command with progress tracking
  commands.forEach((command, index) => {
    scriptLines.push(`echo "--- Command ${index + 1}/${commands.length} ---"`);
    scriptLines.push(`echo "$ ${command}"`);
    scriptLines.push(command);
    scriptLines.push('CMD_EXIT_CODE=$?');
    scriptLines.push('if [ $CMD_EXIT_CODE -ne 0 ]; then');
    scriptLines.push(`  echo "Command ${index + 1} failed with exit code $CMD_EXIT_CODE" >&2`);
    scriptLines.push('  exit $CMD_EXIT_CODE');
    scriptLines.push('fi');
    scriptLines.push('echo ""');
  });
  
  scriptLines.push('echo "=== BASH EXECUTION COMPLETE ==="');
  scriptLines.push('echo "All commands completed successfully"');
  
  return scriptLines.join('\n');
}