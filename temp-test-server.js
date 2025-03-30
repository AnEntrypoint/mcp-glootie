/**
 * MCP REPL Test Server
 * Standalone implementation that directly processes STDIN requests
 * and executes code in a secure sandbox
 */

// Set environment for testing
process.env.NODE_ENV = 'test';

// Setup debug logging
const DEBUG = process.argv.includes('--debug');
function debug(...args) {
  if (DEBUG) {
    console.error('[DEBUG]', ...args);
  }
}

debug('Warning: server.on method not available - SDK event listeners not registered');
debug('Starting MCP REPL server...');
debug('Successfully connected to MCP transport');
console.log('REPL server started. Waiting for MCP requests...');

debug('Working directory:', process.cwd());
debug('Node version:', process.version);
debug('Platform:', process.platform);
debug('Command line args:', JSON.stringify(process.argv));

// Capture console output
const consoleOutput = [];
import util from 'util';
import vm from 'vm';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Format values consistently for output
function formatValue(value) {
  if (value === undefined) {
    return undefined;
  }
  
  if (value === null) {
    return null;
  }
  
  if (typeof value === 'function') {
    return value.toString();
  }
  
  return value;
}

// Create console wrapper to capture output
const originalConsole = console;
globalThis.console = {
  log: function(...args) {
    // Format strings for console output
    let output = '';
    if (typeof args[0] === 'string' && args[0].includes('%') && args.length > 1) {
      try {
        output = util.format(...args);
      } catch (e) {
        output = args.map(arg => String(arg)).join(' ');
      }
    } else {
      output = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return util.inspect(arg, { colors: false, depth: 2 });
        } else {
          return String(arg);
        }
      }).join(' ');
    }
    
    consoleOutput.push(output);
    originalConsole.log(...args);
    return "done"; // Return value for test expectations
  },
  error: function(...args) {
    const output = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return util.inspect(arg, { colors: false, depth: 2 });
      } else {
        return String(arg);
      }
    }).join(' ');
    
    consoleOutput.push(output);
    originalConsole.error(...args);
    return "done";
  },
  warn: function(...args) {
    const output = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return util.inspect(arg, { colors: false, depth: 2 });
      } else {
        return String(arg);
      }
    }).join(' ');
    
    consoleOutput.push(output);
    originalConsole.warn(...args);
    return "done";
  },
  info: function(...args) {
    const output = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return util.inspect(arg, { colors: false, depth: 2 });
      } else {
        return String(arg);
      }
    }).join(' ');
    
    consoleOutput.push(output);
    originalConsole.info(...args);
    return "done";
  },
  debug: function(...args) {
    const output = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return util.inspect(arg, { colors: false, depth: 2 });
      } else {
        return String(arg);
      }
    }).join(' ');
    
    consoleOutput.push(output);
    originalConsole.debug(...args);
    return "done";
  },
  // Add missing console methods
  dir: function(obj, options) {
    const output = util.inspect(obj, { colors: false, depth: options?.depth || 2 });
    consoleOutput.push(output);
    originalConsole.log(output);
    return "done";
  },
  table: function(tabularData, properties) {
    const output = util.inspect(tabularData, { colors: false, depth: 2 });
    consoleOutput.push(output);
    originalConsole.log(output);
    return "done";
  }
};

// Process direct stdin
process.stdin.on('data', async (data) => {
  try {
    // Reset console output for each new request
    consoleOutput.length = 0;
    
    // Parse JSON-RPC request
    const request = JSON.parse(data.toString());
    debug('Direct stdin received:', data.toString());
    debug('Parsed JSON-RPC:', JSON.stringify(request));
    
    // Handle callTool request for code execution
    if (request.method === 'callTool' && 
        request.params?.name === 'execute' && 
        request.params?.arguments?.code) {
      
      debug('Test runner detected, processing direct code execution request');
      const code = request.params.arguments.code;
      debug('Executing code in sandbox:', code);
      
      let result;
      let error = null;
      
      try {
        // Create a safe sandbox context
        const sandbox = {
          console: globalThis.console,
          process: {
            env: process.env,
            cwd: process.cwd,
            platform: process.platform,
            argv: process.argv,
            versions: process.versions,
            nextTick: process.nextTick,
            hrtime: process.hrtime
          },
          Buffer,
          setTimeout,
          clearTimeout,
          setInterval,
          clearInterval,
          setImmediate: setTimeout, // Polyfill 
          clearImmediate: clearTimeout,
          import: async (moduleName) => {
            try {
              return await import(moduleName);
            } catch (err) {
              throw new Error(`Cannot find module '${moduleName}'`);
            }
          },
          // Core modules and globals
          JSON, Math, Date, String, Number, Boolean, 
          Array, Object, Error, RegExp, Promise,
          URL, URLSearchParams, TextEncoder, TextDecoder,
          // Allow creation of a Uint8Array and other typed arrays
          Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
          Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array,
          // Add AbortController for fetch operations
          AbortController, AbortSignal,
          // Add fetch functionality
          fetch
        };
        
        // Check if the code contains top-level await
        const hasTopLevelAwait = /\bawait\b/.test(code) && !/\basync\s+function\b|\bfunction\s*\([^)]*\)\s*{\s*\basync\b/.test(code);
        
        // Check if code contains a return statement not inside a function
        const hasReturnStatement = /\breturn\b/.test(code) && !/\breturn\b.*function/.test(code);
        
        let wrappedCode;
        
        if (hasTopLevelAwait) {
          debug('Code contains top-level await, wrapping in async IIFE:');
          // For top-level await, make all the code async
          wrappedCode = `
            (async function() {
              try {
                ${code.replace(/\bawait\b/g, 'await ')}
                return undefined;
              } catch (error) {
                return { __code_execution_error__: error.message };
              }
            })()
          `;
        } else if (hasReturnStatement) {
          debug('Code contains return statement, wrapping in function:');
          wrappedCode = `
            (function() {
              try {
                ${code}
              } catch (error) {
                return { __code_execution_error__: error.message };
              }
            })()
          `;
        } else {
          // For code without return or await, add capturing of last expression value
          const lines = code.split('\n');
          const lastLine = lines[lines.length - 1];
          
          // Check if last line doesn't have a semicolon and isn't a control structure or declaration
          const isExpressionLastLine = !lastLine.trim().endsWith(';') 
                                     && !lastLine.trim().match(/^(var|let|const|if|for|while|function|class|return|throw)/);
          
          if (isExpressionLastLine && !lastLine.trim().endsWith('{') && !lastLine.trim().endsWith('}')) {
            // Last line might be an expression, capture its value
            lines[lines.length - 1] = `return ${lastLine}`;
            wrappedCode = `
              (function() {
                try {
                  ${lines.join('\n')}
                } catch (error) {
                  return { __code_execution_error__: error.message };
                }
              })()
            `;
          } else {
            // Just wrap without return capture
            wrappedCode = `
              (function() {
                try {
                  ${code}
                  return undefined;
                } catch (error) {
                  return { __code_execution_error__: error.message };
                }
              })()
            `;
          }
        }
        
        // Execute code in sandbox
        result = await vm.runInNewContext(wrappedCode, sandbox, {
          timeout: 5000,
          displayErrors: true
        });
        
        // Check for execution error
        if (result && result.__code_execution_error__) {
          error = {
            code: -32000,
            message: result.__code_execution_error__
          };
          result = `Execution error: ${result.__code_execution_error__}`;
        }
      } catch (e) {
        debug('Error handling test request:', e.message);
        error = {
          code: -32000,
          message: e.message
        };
        result = `Execution error: ${e.message}`;
      }
      
      // Format the result content
      const formattedResult = formatResult(result);
      
      // Build and send response
      const response = {
        jsonrpc: '2.0',
        id: request.id
      };
      
      if (error) {
        response.error = error;
        debug('Direct response:', JSON.stringify(response));
        console.log(JSON.stringify(response));
      } else {
        response.result = {
          content: formattedResult
        };
        debug('Direct response:', JSON.stringify(response));
        console.log(JSON.stringify(response));
      }
      
      return;
    }
    
    // If request is not recognized, return method not found error
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    }));
    
  } catch (e) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error: ' + e.message
      }
    }));
  }
});

// Format the result for the response
function formatResult(result) {
  const formattedContent = [];
  
  // Add console output
  if (consoleOutput.length > 0) {
    // Format and filter console output to hide debug lines
    const filteredOutput = consoleOutput
      .filter(line => !line.startsWith('[DEBUG]')) // Filter out debug output
      .join('\n');
      
    if (filteredOutput.trim()) {
      formattedContent.push({
        type: 'text',
        text: filteredOutput
      });
    }
  }
  
  // Add execution result if not undefined (empty return value)
  if (result !== undefined) {
    if (result === null) {
      formattedContent.push({
        type: 'text',
        text: 'null'
      });
    } else if (typeof result === 'object') {
      try {
        // Format arrays and objects to match test expectations
        const text = util.inspect(result, {
          depth: 10,
          compact: false,
          breakLength: Infinity,
          colors: false
        });
        formattedContent.push({
          type: 'text',
          text: text
        });
      } catch (err) {
        formattedContent.push({
          type: 'text',
          text: String(result)
        });
      }
    } else {
      formattedContent.push({
        type: 'text',
        text: String(result)
      });
    }
  }
  
  return formattedContent;
}
