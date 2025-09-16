

import { validateWorkingDirectory } from './validation-utils.js';
import { createErrorResponse, createSuccessResponse, validateRequiredParams } from './common-errors.js';
import { executeBashCommands } from './process-executor.js';

export async function executeBashCommand(commands, timeout = 120000, workingDirectory, defaultWorkingDir) {
  const startTime = Date.now();

  const paramError = validateRequiredParams({ workingDirectory }, ['workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }
  
  const effectiveWorkingDir = dirValidation.effectiveDir;

  const commandArray = Array.isArray(commands) ? commands : [commands];

  const validationResult = validateBashCommands(commandArray);
  if (!validationResult.valid) {
    return createErrorResponse(validationResult.error, startTime);
  }

  const result = await executeBashCommands(commands, {
    workingDirectory: dirValidation.effectiveDir,
    timeout
  });

  return result;
}

export function validateBashCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    return {
      valid: false,
      error: "Commands must be a non-empty array"
    };
  }

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