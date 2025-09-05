// Consolidated bash executor for MCP REPL project
// Uses shared utilities following KISS principles and DRY patterns

import { validateWorkingDirectory } from './validation-utils.js';
import { createErrorResponse, validateRequiredParams } from './common-errors.js';
import { executeBashCommands } from './process-executor.js';

/**
 * Execute bash commands using consolidated utilities
 */
export async function executeBashCommand(commands, timeout = 120000, workingDirectory, defaultWorkingDir) {
  const startTime = Date.now();
  
  // Validate required parameters using shared utility
  const paramError = validateRequiredParams({ workingDirectory }, ['workingDirectory'], startTime);
  if (paramError) return paramError;
  
  // Validate working directory using shared utility
  const dirValidation = validateWorkingDirectory(workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }
  
  // Validate commands
  const commandArray = Array.isArray(commands) ? commands : [commands];
  const validationResult = validateBashCommands(commandArray);
  if (!validationResult.valid) {
    return createErrorResponse(validationResult.error, startTime);
  }
  
  // Use consolidated process executor
  return await executeBashCommands(commands, {
    workingDirectory: dirValidation.effectiveDir,
    timeout
  });
}

/**
 * Validate bash commands for security and structure
 */
export function validateBashCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return {
      valid: false,
      error: "Commands must be a non-empty array"
    };
  }
  
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    
    if (!command || typeof command !== 'string') {
      return {
        valid: false,
        error: `Command at index ${i} must be a non-empty string`
      };
    }
    
    if (command.trim().length === 0) {
      return {
        valid: false,
        error: `Command ${i}: Cannot be empty or whitespace only`
      };
    }
    
    // Basic security validation - prevent dangerous commands
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
 * Format bash command summary for logging and display
 */
export function formatBashCommandSummary(commands) {
  if (Array.isArray(commands)) {
    if (commands.length === 1) {
      return commands[0].length > 50 ? commands[0].substring(0, 50) + '...' : commands[0];
    }
    return `${commands.length} commands: ${commands[0].substring(0, 30)}...`;
  }
  return commands.length > 50 ? commands.substring(0, 50) + '...' : commands;
}