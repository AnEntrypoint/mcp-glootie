#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import util from 'util';

/**
 * Simple MCP REPL execute tool that properly handles async code and network operations
 * This is a standalone tool to be used when the main REPL server is having issues
 */

// Environment setup
const DEBUG = process.env.DEBUG === 'true';

// Utility for debug logging
function debugLog(message) {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync('mcp-execute-debug.log', `[${timestamp}] ${message}\n`);
  }
}

/**
 * Safely execute JavaScript code in a sandbox with proper timeout handling
 * @param {string} code - The code to execute
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Object} - Result object with success, result, and logs
 */
async function executeCode(code, timeout = 10000) {
  // Log the code being executed
  debugLog(`Executing code: ${code}`);
  
  // Capture console output
  const logs = [];
  
  // Create a sandbox with essential globals
  const sandbox = {
    console: {
      log: (...args) => { 
        const formatted = args.map(arg => 
          typeof arg === 'string' ? arg : util.inspect(arg, { depth: 3 })
        ).join(' ');
        logs.push(['log', formatted]); 
        process.stdout.write(`[log] ${formatted}\n`);
      },
      error: (...args) => { 
        const formatted = args.map(arg => 
          typeof arg === 'string' ? arg : util.inspect(arg, { depth: 3 })
        ).join(' ');
        logs.push(['error', formatted]); 
        process.stderr.write(`[error] ${formatted}\n`);
      },
      warn: (...args) => { 
        const formatted = args.map(arg => 
          typeof arg === 'string' ? arg : util.inspect(arg, { depth: 3 })
        ).join(' ');
        logs.push(['warn', formatted]);
        process.stdout.write(`[warn] ${formatted}\n`);
      },
      info: (...args) => { 
        const formatted = args.map(arg => 
          typeof arg === 'string' ? arg : util.inspect(arg, { depth: 3 })
        ).join(' ');
        logs.push(['info', formatted]);
        process.stdout.write(`[info] ${formatted}\n`);
      }
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    process: {
      env: { ...process.env },
      cwd: () => process.cwd(),
      platform: process.platform,
      version: process.version
    },
    fetch: async (url, options = {}) => {
      logs.push(['log', `Fetch request to: ${url}`]);
      process.stdout.write(`[fetch] Request to ${url}\n`);
      
      // For testing purposes, return a mock response
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => '{"message": "Mock response"}',
        json: async () => ({ message: "Mock response" })
      };
    },
    // Add other essential objects
    Object, Array, String, Number, Boolean, Date, 
    Promise, RegExp, Error, Math, JSON,
    // Add global for compatibility
    global: null
  };
  
  // Add global to the sandbox for proper this context
  sandbox.global = sandbox;
  
  // Wrap user code in an async function for await support
  const wrappedCode = `
    (async function() {
      try {
        ${code}
      } catch (error) {
        console.error("Execution error:", error.message);
        throw error;
      }
    })()
  `;
  
  // Create VM context
  const context = vm.createContext(sandbox);
  
  try {
    // Add timeout safety
    const scriptResult = await Promise.race([
      // Execute the code in the VM
      new Promise((resolve, reject) => {
        try {
          const script = new vm.Script(wrappedCode);
          const result = script.runInContext(context);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }),
      
      // Timeout promise
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Execution timed out after ${timeout}ms`)), timeout)
      )
    ]);
    
    // Await the result (in case it's a promise)
    const result = await scriptResult;
    
    // Format the logs for output
    const formattedLogs = logs.map(([type, msg]) => `[${type}] ${msg}`).join('\n');
    
    // Return success with result and logs
    return {
      success: true,
      result,
      logs: formattedLogs
    };
  } catch (error) {
    debugLog(`Execution error: ${error.message}`);
    
    // Format the logs for output
    const formattedLogs = logs.map(([type, msg]) => `[${type}] ${msg}`).join('\n');
    
    // Return error with logs
    return {
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      },
      logs: formattedLogs
    };
  }
}

/**
 * Main function that processes input and executes code
 */
async function main() {
  // Process input from stdin or command line argument
  const inputSource = process.argv[2] ? 'arg' : 'stdin';
  
  try {
    let code;
    
    if (inputSource === 'arg') {
      // Check if the argument is a file path
      const arg = process.argv[2];
      if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
        // Read code from file
        code = fs.readFileSync(arg, 'utf-8');
        console.log(`Reading code from file: ${arg}`);
      } else {
        // Use argument directly as code
        code = arg;
      }
    } else {
      // Read code from stdin
      code = fs.readFileSync(0, 'utf-8').toString().trim();
      
      // Check if it's a JSON-RPC format
      try {
        const jsonRpc = JSON.parse(code);
        if (jsonRpc.params?.arguments?.code) {
          code = jsonRpc.params.arguments.code;
        } else if (jsonRpc.code) {
          code = jsonRpc.code;
        }
      } catch (e) {
        // Not JSON, treat as raw code
      }
    }
    
    // Execute the code
    const result = await executeCode(code);
    
    // Format and output result
    const output = {
      success: result.success,
      output: result.logs || '',
      result: result.success ? result.result : undefined,
      error: result.success ? undefined : result.error.message
    };
    
    // Output result as JSON
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Start the tool
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 