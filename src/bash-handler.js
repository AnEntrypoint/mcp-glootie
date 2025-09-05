// Bash handler for MCP tool integration
// Provides the MCP interface for bash command execution

import { executeBashCommand } from './bash-executor.js';

/**
 * Handle executebash MCP tool requests
 * @param {Object} args - Tool arguments containing commands and execution parameters
 * @param {string} defaultWorkingDir - Server's default working directory
 * @returns {Object} MCP tool response with execution results
 */
export async function handleBashExecute(args, defaultWorkingDir) {
  const startTime = Date.now();
  
  try {
    const { 
      commands, 
      command,  // Support both singular and plural for flexibility
      timeout = 120000, 
      workingDirectory 
    } = args;
    
    // Support both 'command' and 'commands' parameters for flexibility
    const finalCommands = commands || (command ? [command] : null);
    
    if (!finalCommands) {
      throw new Error("Missing 'commands' parameter for executebash tool");
    }
    
    // Validate required working directory parameter
    if (!workingDirectory) {
      throw new Error("workingDirectory parameter is required for executebash tool");
    }
    
    // Execute bash command(s)
    const result = await executeBashCommand(finalCommands, timeout, workingDirectory, defaultWorkingDir);
    
    // Format MCP response
    const contentLines = [];
    
    // Add execution header
    const commandText = Array.isArray(finalCommands) ? finalCommands.join('; ') : finalCommands;
    const commandSummary = Array.isArray(finalCommands) && finalCommands.length > 1 
      ? `${finalCommands.length} commands` 
      : '1 command';
      
    contentLines.push({
      type: 'text',
      text: `Bash execution (${commandSummary}) in: ${result.workingDirectory || workingDirectory}`
    });
    
    if (result.success) {
      // Add stdout if available
      if (result.stdout) {
        contentLines.push({
          type: 'text',
          text: result.stdout
        });
      }
      
      // Add stderr as warning if available but execution succeeded
      if (result.stderr) {
        contentLines.push({
          type: 'text',
          text: `WARNING: ${result.stderr}`
        });
      }
      
      // Add success summary
      contentLines.push({
        type: 'text',
        text: `Bash execution completed successfully in ${result.executionTimeMs}ms (exit code: ${result.exitCode || 0})`
      });
      
    } else {
      // Add error output
      if (result.stdout) {
        contentLines.push({
          type: 'text',
          text: `OUTPUT: ${result.stdout}`
        });
      }
      
      if (result.stderr) {
        contentLines.push({
          type: 'text',
          text: `ERROR: ${result.stderr}`
        });
      }
      
      if (result.error) {
        contentLines.push({
          type: 'text',
          text: `ERROR: ${result.error}`
        });
      }
      
      // Add failure summary
      const exitText = result.exitCode ? ` (exit code: ${result.exitCode})` : '';
      contentLines.push({
        type: 'text',
        text: `Bash execution failed in ${result.executionTimeMs}ms${exitText}`
      });
    }
    
    return {
      content: contentLines
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `BASH EXECUTION ERROR: ${error.message}`
        }
      ]
    };
  }
}

/**
 * Format bash command for display in batch execution logs
 * @param {string|Array} commands - Commands to format
 * @returns {string} Formatted command string
 */
export function formatBashCommandSummary(commands) {
  if (Array.isArray(commands)) {
    if (commands.length === 1) {
      return commands[0].length > 50 ? commands[0].substring(0, 50) + '...' : commands[0];
    } else {
      return `${commands.length} commands: ${commands[0].substring(0, 30)}...`;
    }
  } else {
    return commands.length > 50 ? commands.substring(0, 50) + '...' : commands;
  }
}