#!/usr/bin/env node

/**
 * MCP Execute Tool - Clean Implementation
 * 
 * This tool executes JavaScript code in a separate process, avoiding the issues
 * with blocking the main REPL server.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEBUG = process.env.DEBUG_MCP_EXECUTE === 'true';

/**
 * Debug logger function
 */
function debugLog(...args) {
  if (DEBUG) {
    console.log('[MCP-EXECUTE]', ...args);
  }
}

/**
 * Execute JavaScript code in a separate process
 * 
 * @param {string} code - JavaScript code to execute
 * @param {Object} options - Execution options
 * @param {number} [options.timeout=30000] - Execution timeout in milliseconds
 * @returns {Promise<{success: boolean, logs: string[]}>}
 */
export async function executeCode(code, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT
  } = options;
  
  debugLog('Executing code with timeout:', timeout);
  
  // Create a temporary file with the code
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFile = path.join(tempDir, `mcp-execute-${Date.now()}.js`);
  
  // Write code directly to temp file, no wrapper
  fs.writeFileSync(tempFile, code);
  
  debugLog('Code written to temp file:', tempFile);
  
  // Execute the code in a separate process with output capture
  return new Promise((resolve) => {
    const logs = [];
    
    debugLog('Spawning Node process with file:', tempFile);
    
    const nodeProcess = spawn('node', [tempFile], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Set up timeout
    const timeoutId = setTimeout(() => {
      debugLog('Execution timed out after', timeout, 'ms');
      nodeProcess.kill();
      logs.push(`Execution timed out after ${timeout}ms`);
      resolve({
        success: false,
        logs
      });
    }, timeout);
    
    // Collect stdout
    nodeProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          logs.push(line);
          if (DEBUG) {
            console.log('[STDOUT]', line);
          }
        }
      });
    });
    
    // Collect stderr
    nodeProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          logs.push(`[ERROR] ${line}`);
          if (DEBUG) {
            console.error('[STDERR]', line);
          }
        }
      });
    });
    
    // Handle process completion
    nodeProcess.on('close', (code) => {
      clearTimeout(timeoutId);
      
      debugLog('Process exited with code:', code);
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFile);
        debugLog('Temp file cleaned up');
      } catch (error) {
        debugLog('Failed to clean up temp file:', error.message);
      }
      
      resolve({
        success: code === 0,
        logs
      });
    });
    
    // Handle process errors
    nodeProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      
      debugLog('Process error:', error.message);
      logs.push(`[ERROR] ${error.message}`);
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFile);
        debugLog('Temp file cleaned up');
      } catch (err) {
        debugLog('Failed to clean up temp file:', err.message);
      }
      
      resolve({
        success: false,
        logs
      });
    });
  });
}

/**
 * Execute JavaScript from a file
 * 
 * @param {string} filePath - Path to the JavaScript file
 * @param {Object} options - Execution options
 * @returns {Promise<{success: boolean, logs: string[]}>}
 */
export async function executeFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      logs: [`File not found: ${filePath}`]
    };
  }
  
  const code = fs.readFileSync(filePath, 'utf-8');
  return executeCode(code, options);
}

// Handle direct invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node clean-mcp-execute.js <file.js | "code...">\n');
    console.log('Options:');
    console.log('  --timeout <ms>     Execution timeout in milliseconds (default: 30000)');
    console.log('  --debug            Enable debug logging');
    console.log('  --direct           Execute the file directly without showing logs');
    process.exit(1);
  }
  
  // Parse options
  let filePath;
  let codeArg;
  let directMode = false;
  const execOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--timeout' && i + 1 < args.length) {
      execOptions.timeout = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--debug') {
      process.env.DEBUG_MCP_EXECUTE = 'true';
    } else if (args[i] === '--direct') {
      directMode = true;
    } else if (!filePath && !codeArg) {
      // Check if it's a file path or direct code
      if (fs.existsSync(args[i])) {
        filePath = args[i];
      } else {
        codeArg = args[i];
      }
    }
  }
  
  debugLog('Starting execution with options:', execOptions);
  
  // Direct execution mode (use spawn with stdio inherit)
  if (directMode && filePath) {
    console.log(`\n========== EXECUTING ${filePath} DIRECTLY ==========\n`);
    
    const nodeProcess = spawn('node', [filePath], {
      stdio: 'inherit'
    });
    
    nodeProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`\n========== EXECUTION COMPLETED SUCCESSFULLY ==========\n`);
      } else {
        console.error(`\n========== EXECUTION FAILED WITH CODE ${code} ==========\n`);
        process.exit(code);
      }
    });
    
    nodeProcess.on('error', (error) => {
      console.error(`\n========== EXECUTION ERROR ==========\n`);
      console.error(error.message);
      process.exit(1);
    });
  } 
  // Regular execution mode
  else {
    // Execute code
    const executePromise = filePath 
      ? executeFile(filePath, execOptions)
      : executeCode(codeArg, execOptions);
    
    executePromise.then(result => {
      console.log('\n===== EXECUTION COMPLETED =====');
      console.log('Success:', result.success ? 'Yes' : 'No');
      
      if (result.logs && result.logs.length > 0) {
        console.log('\n----- CAPTURED OUTPUT -----');
        result.logs.forEach(log => {
          console.log(log);
        });
        console.log('--------------------------');
      }
      
      // Exit with appropriate code
      if (!result.success) {
        process.exit(1);
      }
    }).catch(error => {
      console.error('Failed to execute:', error.message);
      process.exit(1);
    });
  }
} 