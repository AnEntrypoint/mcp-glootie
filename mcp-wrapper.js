#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import util from 'util';
import { spawn } from 'child_process';

/**
 * Fixed MCP REPL execute wrapper that handles code execution properly
 * 
 * This wrapper solves issues with:
 * 1. Preventing the REPL from getting stuck on async operations
 * 2. Properly capturing and returning results from executed code
 * 3. Handling network and file system operations safely
 */

// Constants
const MAX_EXECUTION_TIME = 10000; // 10 seconds max execution time
const DEBUG_MODE = process.env.DEBUG === 'true';

// Debug logging
function debugLog(message) {
  if (DEBUG_MODE) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync('mcp-wrapper-debug.log', `[${timestamp}] ${message}\n`);
  }
}

/**
 * Execute code in a sandboxed environment with proper timeout
 * @param {string} code - JavaScript code to execute
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} - Execution result
 */
export async function executeCode(code, options = {}) {
  const timeout = options.timeout || MAX_EXECUTION_TIME;
  debugLog(`Executing code with timeout ${timeout}ms: ${code}`);
  
  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Write code to a temp file
  const timestamp = Date.now();
  const codeFilePath = path.join(tempDir, `code-${timestamp}.js`);
  fs.writeFileSync(codeFilePath, code);
  
  try {
    // Execute code in a separate process to avoid blocking
    return await new Promise((resolve, reject) => {
      // Create a timeout to kill the process if it takes too long
      const timeoutId = setTimeout(() => {
        debugLog(`Execution timed out after ${timeout}ms`);
        if (childProcess) {
          childProcess.kill();
        }
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);
      
      // Spawn a Node.js process to execute our code
      const childProcess = spawn('node', [codeFilePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout
      });
      
      let stdout = '';
      let stderr = '';
      
      // Capture output
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        try {
          // Clean up the temp file
          fs.unlinkSync(codeFilePath);
        } catch (err) {
          debugLog(`Error removing temp file: ${err.message}`);
        }
        
        if (code !== 0) {
          debugLog(`Process exited with code ${code}`);
          resolve({
            success: false,
            error: { 
              message: `Process exited with code ${code}`,
              details: stderr
            },
            logs: stderr || stdout
          });
        } else {
          debugLog(`Process completed successfully`);
          
          // Try to extract the result from stdout
          let result;
          try {
            // Look for any valid JSON output in the stdout
            const jsonMatches = stdout.match(/\{[\s\S]*\}/g);
            if (jsonMatches && jsonMatches.length > 0) {
              const lastJson = jsonMatches[jsonMatches.length - 1];
              result = JSON.parse(lastJson);
            } else {
              result = stdout.trim();
            }
          } catch (e) {
            result = stdout.trim();
          }
          
          resolve({
            success: true,
            result: result,
            logs: stdout
          });
        }
      });
      
      // Handle process errors
      childProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        debugLog(`Process error: ${err.message}`);
        
        try {
          // Clean up the temp file
          fs.unlinkSync(codeFilePath);
        } catch (cleanupErr) {
          debugLog(`Error removing temp file: ${cleanupErr.message}`);
        }
        
        resolve({
          success: false,
          error: {
            message: err.message,
            stack: err.stack
          },
          logs: stderr || stdout
        });
      });
    });
  } catch (error) {
    debugLog(`Execution error: ${error.message}`);
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      },
      logs: []
    };
  }
}

/**
 * Format execution result for MCP response
 * @param {Object} result - Execution result
 * @returns {Object} - Formatted MCP response
 */
export function formatMCPResponse(result) {
  const content = [];
  
  // Add logs if available
  if (result.logs) {
    content.push({
      type: 'text',
      text: result.logs
    });
  }
  
  // Add result or error
  if (result.success) {
    let resultText;
    
    if (result.result === undefined) {
      resultText = 'undefined';
    } else if (result.result === null) {
      resultText = 'null';
    } else if (typeof result.result === 'string') {
      resultText = result.result;
    } else {
      try {
        resultText = util.inspect(result.result, {
          depth: 5,
          compact: false,
          maxArrayLength: 100
        });
      } catch (e) {
        resultText = String(result.result);
      }
    }
    
    content.push({
      type: 'text',
      text: resultText
    });
  } else {
    // Handle error case
    const errorMessage = result.error?.message || 'Unknown error';
    content.push({
      type: 'text',
      text: `ERROR: ${errorMessage}`
    });
  }
  
  return { content };
}

/**
 * Execute code and return formatted MCP response
 * @param {string} code - JavaScript code to execute
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} - MCP response
 */
export async function executeAndFormat(code, options = {}) {
  const result = await executeCode(code, options);
  return formatMCPResponse(result);
}

// Export the functions
export default {
  executeCode,
  formatMCPResponse,
  executeAndFormat
}; 