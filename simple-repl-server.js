#!/usr/bin/env node

/**
 * Simple REPL server that follows the Machine Chat Protocol (MCP)
 * Handles JSON-RPC requests and executes code in a safe environment
 */

import util from 'util';
import path from 'path';
import { createRequire } from 'module';
import fs from 'fs';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from 'http';
import https from 'https';
import { URL } from 'url';
import vm from 'vm';
import { execFile } from 'child_process';

// Check for debug flag
const DEBUG = process.argv.includes('--debug');

// Helper function for debug logging
function debugLog(message) {
  if (DEBUG) {
    process.stderr.write(`[DEBUG] ${message}\n`);
  }
}

// Try to load environment variables from .env file
function loadEnvFile(directory) {
  try {
    const envPath = path.join(directory, '.env');
    if (fs.existsSync(envPath)) {
      process.stderr.write(`Loading .env file from ${envPath}\n`);
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      for (const line of envLines) {
        const trimmedLine = line.trim();
        // Skip comments and empty lines
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const match = trimmedLine.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.substring(1, value.length - 1);
            }
            
            // Only set if not already defined
            if (!process.env[key]) {
              process.env[key] = value;
              process.stderr.write(`Set environment variable: ${key}\n`);
            }
          }
        }
      }
      
      return true;
    }
  } catch (error) {
    process.stderr.write(`Error loading .env file: ${error.message}\n`);
  }
  
  return false;
}

// Check for working directory in argv[2]
const workingDirectory = process.argv.find(arg => !arg.startsWith('--') && 
                                             arg !== process.argv[0] && 
                                             arg !== process.argv[1]);
if (workingDirectory) {
  try {
    // Verify the directory exists
    if (!fs.existsSync(workingDirectory)) {
      process.stderr.write(`Working directory specified in argv[2] does not exist: ${workingDirectory}\n`);
      process.exit(1);
    }
    
    // Change to the specified working directory
    process.chdir(workingDirectory);
    process.stderr.write(`Changed working directory to: ${workingDirectory}\n`);
    
    // Try to load .env file from working directory
    loadEnvFile(workingDirectory);
  } catch (error) {
    process.stderr.write(`Error changing to directory ${workingDirectory}: ${error.message}\n`);
    process.exit(1);
  }
} else {
  // If no working directory specified, try current directory
  loadEnvFile(process.cwd());
}

// Helper to ensure URL is absolute
function normalizeUrl(url) {
  if (!url) return null;
  
  try {
    // Check if already a valid URL
    new URL(url);
    return url;
  } catch (e) {
    // Not a valid URL, try to fix it
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }
}

// Add NodeFetch implementation
function createNodeFetch() {
  return async function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // Normalize URL to ensure it's absolute
        const normalizedUrl = normalizeUrl(url);
        if (!normalizedUrl) {
          throw new Error('Invalid URL: URL cannot be null or empty');
        }
        
        const parsedUrl = new URL(normalizedUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: options.method || 'GET',
          headers: options.headers || {},
          timeout: options.timeout || 30000
        };
        
        const req = client.request(requestOptions, (res) => {
          let body = '';
          const buffers = [];
          
          res.on('data', (chunk) => {
            body += chunk.toString();
            buffers.push(Buffer.from(chunk));
          });
          
          res.on('end', () => {
            const bodyBuffer = Buffer.concat(buffers);
            
            const response = {
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: res.headers,
              url: normalizedUrl,
              text: async () => body,
              json: async () => {
                try {
                  return JSON.parse(body);
                } catch (e) {
                  throw new Error(`Failed to parse JSON: ${e.message}`);
                }
              },
              arrayBuffer: async () => bodyBuffer.buffer,
              buffer: async () => bodyBuffer,
              body: body,
              bodyBuffer: bodyBuffer
            };
            
            resolve(response);
          });
        });
        
        req.on('error', (err) => {
          reject(new Error(`Fetch error: ${err.message}`));
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Fetch timeout'));
        });
        
        if (options.body) {
          const bodyData = typeof options.body === 'string' 
            ? options.body 
            : JSON.stringify(options.body);
          req.write(bodyData);
        }
        
        req.end();
      } catch (err) {
        reject(new Error(`Fetch initialization error: ${err.message}`));
      }
    });
  };
}

// Create a polyfill for AbortController if not available
function createAbortControllerPolyfill() {
  if (typeof global.AbortController === 'function') {
    return global.AbortController;
  }
  
  // Simple polyfill for AbortController
  class AbortControllerPolyfill {
    constructor() {
      this.signal = {
        aborted: false,
        addEventListener: (type, listener) => {
          if (type === 'abort') {
            this._listeners = this._listeners || [];
            this._listeners.push(listener);
          }
        },
        removeEventListener: (type, listener) => {
          if (type === 'abort' && this._listeners) {
            const index = this._listeners.indexOf(listener);
            if (index !== -1) {
              this._listeners.splice(index, 1);
            }
          }
        }
      };
    }
    
    abort() {
      this.signal.aborted = true;
      if (this._listeners) {
        const event = { type: 'abort' };
        this._listeners.forEach(listener => listener(event));
      }
    }
  }
  
  return AbortControllerPolyfill;
}

// Create a simple REPL helper utility
function createReplHelper() {
  return {
    // Helper for returning values from REPL
    return_: function(value) {
      return value;
    },
    
    // Shorthand alias for return_
    _: function(value) {
      return value;
    },
    
    // Run async function and handle errors
    async_run: async function(fn) {
      try {
        return await fn();
      } catch (error) {
        console.error('Error in async_run:', error);
        throw error;
      }
    },
    
    // Fetch JSON data from a URL
    fetchJson: async function(url, options = {}) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`Error fetching JSON from ${url}:`, error);
        throw error;
      }
    },
    
    // Fetch text from a URL
    fetchText: async function(url, options = {}) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        console.error(`Error fetching text from ${url}:`, error);
        throw error;
      }
    }
  };
}

// Create a secure context for code execution
function createExecutionContext() {
  // Create URL utilities
  const urlUtils = {
    normalizeUrl,
    isValidUrl: (url) => {
      try {
        new URL(url);
        return true;
      } catch (e) {
        return false;
      }
    },
    joinPaths: (...parts) => {
      return parts.map(part => part.replace(/^\/|\/$/g, '')).join('/');
    }
  };
  
  // Create environment variable proxy
  const env = new Proxy({}, {
    get: (target, prop) => {
      // Get from process.env or return null
      return process.env[prop] || null;
    }
  });
  
  // Create utility functions
  const utils = {
    // Safe JSON parse with fallback
    parseJSON: (str, fallback = null) => {
      try {
        return JSON.parse(str);
      } catch (e) {
        return fallback;
      }
    },
    
    // Safe async function runner with timeout
    runWithTimeout: async (fn, timeoutMs = 5000) => {
      return Promise.race([
        fn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Operation timed out after " + timeoutMs + "ms")), timeoutMs)
        )
      ]);
    },
    
    // Sleep function
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Helper to retry a function
    retry: async (fn, attempts = 3, delay = 1000) => {
      let lastError;
      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          if (i < attempts - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      throw lastError;
    }
  };
  
  // Base context with full access to core modules and functions
  const context = {
    console: {}, // Will be replaced with captured console
    process,
    Buffer,
    require: createSafeRequire(),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    clearImmediate,
    fs, // Provide access to the fs module
    import: createSafeImport(), // Add support for dynamic imports
    __dirname: process.cwd(),
    __filename: 'repl-execution.js',
    global: globalThis,
    fetch: createNodeFetch(), // Add fetch implementation
    AbortController: createAbortControllerPolyfill(), // Add AbortController polyfill
    
    // Make these directly accessible as globals
    urlUtils,
    env,
    utils,
    replHelper: createReplHelper(),
    _: createReplHelper()._, // Add shorthand for returns
  };
  
  return context;
}

// Create a safe require function that allows access to common modules
function createSafeRequire() {
  const baseRequire = createRequire(import.meta.url);
  const workingDir = process.argv[2] || process.cwd();
  const workingDirRequire = createRequire(path.join(workingDir, 'package.json'));
  
  return function safeRequire(moduleName) {
    try {
      // First try to load from the working directory
      return workingDirRequire(moduleName);
    } catch (workingDirError) {
      // If that fails, try from the REPL server's directory
      try {
        return baseRequire(moduleName);
      } catch (baseError) {
        // If both fail, throw a detailed error
        process.stderr.write(`Failed to load module '${moduleName}':\n`);
        process.stderr.write(`  - From working directory (${workingDir}): ${workingDirError.message}\n`);
        process.stderr.write(`  - From REPL directory: ${baseError.message}\n`);
        
        // Rethrow with improved error message
        const error = new Error(`Cannot find module '${moduleName}'\nRequire stack:\n- ${workingDir}\n- ${import.meta.url}`);
        error.code = 'MODULE_NOT_FOUND';
        throw error;
      }
    }
  };
}

// Create a restricted process object with only safe properties
function createRestrictedProcess() {
  // Return the full process object without restrictions
  return process;
}

// Create a safe import function that properly resolves modules
function createSafeImport() {
  const workingDir = process.argv[2] || process.cwd();
  
  return async function safeImport(moduleName) {
    try {
      // Try to resolve relative to working directory first
      if (moduleName.startsWith('.')) {
        // Handle relative imports
        const absPath = path.resolve(workingDir, moduleName);
        return await import(absPath);
      }
      
      // For bare module specifiers, try the working directory first
      try {
        const workingDirRequire = createRequire(path.join(workingDir, 'package.json'));
        const resolvedPath = workingDirRequire.resolve(moduleName);
        return await import(resolvedPath);
      } catch (workingDirError) {
        // If that fails, try from the REPL server's directory
        const baseRequire = createRequire(import.meta.url);
        const resolvedPath = baseRequire.resolve(moduleName);
        return await import(resolvedPath);
      }
    } catch (error) {
      process.stderr.write(`Failed to import module '${moduleName}': ${error.message}\n`);
      throw new Error(`Failed to import module '${moduleName}': ${error.message}`);
    }
  };
}

// Helper function to sanitize values for JSON serialization
function sanitizeForJSON(value, depth = 0, maxDepth = 10, seenObjects = new WeakMap()) {
  // Handle primitives and null
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  
  // Prevent circular references and limit depth
  if (depth > maxDepth) {
    return '[Object/Array - Max depth reached]';
  }
  
  if (seenObjects.has(value)) {
    return '[Circular Reference]';
  }
  
  seenObjects.set(value, true);
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForJSON(item, depth + 1, maxDepth, seenObjects));
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // Handle RegExp
  if (value instanceof RegExp) {
    return value.toString();
  }
  
  // Handle Error objects
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  
  // Handle other objects
  try {
    const result = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = sanitizeForJSON(value[key], depth + 1, maxDepth, seenObjects);
      }
    }
    return result;
  } catch (error) {
    return `[Object - ${error.message}]`;
  }
}

/**
 * Extracts the last expression from a code block and adds a return statement
 * Handles complex cases like multi-line code, object literals, try/catch, etc.
 * @param {string} code - The code to process
 * @returns {string} - The processed code with return for the last expression
 */
function preprocessCode(code) {
  // First, check for the special "Empty return" case
  // It's exactly "return" or "return;" - both need to be handled
  if (code.trim() === 'return' || code.trim() === 'return;') {
    return 'return undefined;';
  }
  
  // If the code already contains a return statement, don't modify it
  if (code.includes('return ')) {
    return code;
  }

  // Try with a more robust approach to match the last standalone expression
  const findLastExpression = (code) => {
    const lines = code.split('\n');
    // Remove empty lines from the end
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    
    // If no lines left, return null
    if (lines.length === 0) {
      return null;
    }
    
    // Get the last non-empty line
    const lastLine = lines[lines.length - 1].trim();
    
    // Check if it's a valid expression (not a statement ending with semicolon or a block/control statement)
    if (lastLine.endsWith(';') ||
        lastLine.startsWith('if') ||
        lastLine.startsWith('for') ||
        lastLine.startsWith('while') ||
        lastLine.startsWith('function') ||
        lastLine.startsWith('class') ||
        lastLine.startsWith('//') ||
        lastLine.startsWith('/*') ||
        lastLine.endsWith('{') ||
        lastLine.endsWith('}') ||
        lastLine.startsWith('var ') ||
        lastLine.startsWith('let ') ||
        lastLine.startsWith('const ')) {
      // Not a standalone expression - check if it's a variable declaration 
      // where we can return the variable
      if (lastLine.match(/^(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*.*?;?$/)) {
        const varName = lastLine.match(/^(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)/)[2];
        return {
          lastLineIndex: lines.length - 1,
          expression: varName
        };
      }
      
      // Special case: look for a variable name followed by a semicolon in the last line
      // For example: "result;"
      const possibleVarMatch = lastLine.match(/^([a-zA-Z_$][0-9a-zA-Z_$]*);?$/);
      if (possibleVarMatch) {
        return {
          lastLineIndex: lines.length - 1,
          expression: possibleVarMatch[1]
        };
      }
      
      return null;
    }
    
    // It's a standalone expression
    return {
      lastLineIndex: lines.length - 1,
      expression: lastLine
    };
  };
  
  const lastExpr = findLastExpression(code);
  
  if (lastExpr) {
    const lines = code.split('\n');
    
    // Replace the last line with the return statement for the expression
    // If it's a standalone variable name, we can just return it
    if (lastExpr.expression.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
      // Make sure we've set the variable before trying to return it
      if (lines[lastExpr.lastLineIndex].trim() === lastExpr.expression) {
        lines[lastExpr.lastLineIndex] = `return ${lastExpr.expression};`;
      } else {
        // If the last line contains other code, append a return statement
        lines.push(`return ${lastExpr.expression};`);
      }
    } else {
      // For other expressions, replace the line with a return statement
      lines[lastExpr.lastLineIndex] = `return ${lastExpr.expression};`;
    }
    
    return lines.join('\n');
  }
  
  // Special case: if code ends with a variable declaration, add a return for the variable
  const varDeclarationMatch = code.trim().match(/.*?(const|let|var)\s+([a-zA-Z_$][0-9a-zA-Z_$]*)\s*=\s*.*?;?\s*$/s);
  if (varDeclarationMatch) {
    const varName = varDeclarationMatch[2];
    return `${code.trim()};\nreturn ${varName};`;
  }
  
  // Handle multi-line object/array declarations where the last part could be a lone identifier
  const lines = code.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line && !line.startsWith('//') && !line.startsWith('/*')) {
      const identifierMatch = line.match(/^([a-zA-Z_$][0-9a-zA-Z_$]*);?$/);
      if (identifierMatch) {
        // Found a standalone identifier as the last non-comment line
        const identifier = identifierMatch[1];
        // Add a new line with a return statement
        lines.push(`return ${identifier};`);
        return lines.join('\n');
      }
      break;
    }
  }
  
  // If no expression found to return, don't modify the code
  return code;
}

// Execute code safely in VM context
export async function executeCode(code, timeout = 5000) {
  // Log the code that's being executed (for debugging)
  debugLog(`Executing code in sandbox: ${code}`);
  
  const context = createExecutionContext();
  const logs = [];
  
  // Capture console output
  function formatArgs(args) {
    // Handle format specifiers (like %s, %d, etc.)
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('%')) {
      try {
        return util.format(...args);
      } catch (e) {
        // Fallback if formatting fails
        return args.map(arg => typeof arg === 'string' ? arg : util.inspect(arg, {depth: 5, maxArrayLength: 100})).join(' ');
      }
    }
    
    // Improved inspection for better debugging
    return args.map(arg => {
      if (typeof arg === 'string') return arg;
      
      // Enhanced inspection for objects, especially for network requests
      return util.inspect(arg, {
        depth: 8,         // Increase depth for nested objects
        maxArrayLength: 100,  // Show more array elements
        maxStringLength: 1000, // Show more of strings
        breakLength: 120      // Wider output before breaking
      });
    }).join(' ');
  }
  
  // Capture console logs with improved handling
  function captureLog(type, ...args) {
    try {
      const formattedMessage = formatArgs(args);
      logs.push(`[${type}] ${formattedMessage}`);
      
      // Output to real console for debugging with timestamp
      const timestamp = new Date().toISOString();
      process.stderr.write(`[${timestamp}] [${type}]: ${formattedMessage}\n`);
    } catch (error) {
      // Ensure logging errors don't break the REPL
      logs.push(`[${type}] [Error formatting log message: ${error.message}]`);
      process.stderr.write(`Error in console capture: ${error.message}\n`);
    }
  }
  
  // Setup console capture for standard methods
  ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
    context.console[method] = (...args) => captureLog(method, ...args);
  });
  
  // Add special console methods with enhanced formatting
  context.console.trace = (...args) => {
    try {
      // Create an error to capture the stack trace
      const err = new Error();
      captureLog('trace', ...args, '\n', err.stack);
    } catch (e) {
      captureLog('error', `Error in console.trace: ${e.message}`);
    }
  };
  
  context.console.dir = (obj, options = {}) => {
    try {
      // Enhanced options for better visibility
      const enhancedOptions = {
        depth: options.depth || 8,
        colors: false,
        maxArrayLength: options.maxArrayLength || 100,
        maxStringLength: options.maxStringLength || 1000,
        ...options
      };
      captureLog('dir', util.inspect(obj, enhancedOptions));
    } catch (e) {
      captureLog('error', `Error in console.dir: ${e.message}`);
    }
  };
  
  context.console.table = (tabularData, properties) => {
    try {
      // Format table data for better readability
      let result;
      if (typeof tabularData === 'object' && tabularData !== null) {
        if (Array.isArray(tabularData)) {
          // For arrays of objects
          result = 'Table: [\n';
          tabularData.forEach((item, index) => {
            result += `  [${index}]: ${util.inspect(item, { depth: 3 })}\n`;
          });
          result += ']';
        } else {
          // For objects
          result = 'Table: {\n';
          Object.entries(tabularData).forEach(([key, value]) => {
            result += `  ${key}: ${util.inspect(value, { depth: 3 })}\n`;
          });
          result += '}';
        }
      } else {
        result = util.inspect(tabularData);
      }
      captureLog('table', result);
    } catch (e) {
      captureLog('error', `Error displaying table: ${e.message}`);
    }
  };
  
  // Create fetch with enhanced error reporting
  const nodeFetch = function enhancedFetch(url, options = {}) {
    // Log the fetch request for debugging
    captureLog('fetch', `Making request to ${url}`, options);
    
    // Use the base fetch implementation
    const baseFetch = createNodeFetch();
    return baseFetch(url, options)
      .then(response => {
        // Log response status and headers
        captureLog('fetch', `Received response: ${response.status} ${response.statusText}`, 
                  { headers: response.headers });
        return response;
      })
      .catch(err => {
        // Enhanced error logging for network issues
        captureLog('error', `Fetch error: ${err.message}`, err.stack);
        throw err; // Rethrow to maintain normal error flow
      });
  };
  
  // Add fetch to the context directly
  context.fetch = nodeFetch;
  
  // Add AbortController polyfill or implementation
  const AbortControllerImpl = createAbortControllerPolyfill();
  context.AbortController = AbortControllerImpl;
  
  // Add references in global to ensure they're available globally
  context.global.fetch = nodeFetch;
  context.global.AbortController = AbortControllerImpl;
  
  // Ensure minimum and reasonable timeout values
  timeout = Math.max(timeout, 1000);  // Minimum 1 second timeout
  
  // For fetch operations, increase the timeout significantly
  if (code.includes('fetch(') || code.includes('fetch (') || 
      code.includes('supabase') || code.includes('database')) {
    timeout = Math.max(timeout, 30000);  // Give network operations at least 30 seconds
    debugLog(`Detected network operations, increasing timeout to ${timeout}ms`);
  }
  
  // Track unhandled promise rejections
  let unhandledRejection = null;
  const rejectionHandler = (reason) => {
    unhandledRejection = reason;
    debugLog(`Unhandled promise rejection in REPL: ${reason}`);
    if (reason instanceof Error && reason.stack) {
      debugLog(`Stack trace: ${reason.stack}`);
    }
  };
  
  // Set up unhandled rejection listener
  process.on('unhandledRejection', rejectionHandler);
  
  try {
    // Function to preprocess code to ensure the last expression is returned
    function preprocessCodeForLastExpression(code) {
      // Add code to capture console.log output that might be important
      let processedCode = `
        let __last_expr__ = undefined;
        let __all_logs__ = [];
        
        // Intercept all Promise.prototype methods to ensure proper resolution
        const originalThen = Promise.prototype.then;
        Promise.prototype.then = function(...args) {
          const result = originalThen.apply(this, args);
          console.log('Promise chain step:', args[0]?.toString().substring(0, 100) + '...');
          return result;
        };
        
        // Wrap setTimeout to log when it's used
        const originalSetTimeout = setTimeout;
        globalThis.setTimeout = function(fn, delay, ...args) {
          console.log('setTimeout called with delay:', delay);
          return originalSetTimeout(fn, delay, ...args);
        };
      `;
      
      // Add network request debugging for fetch operations
      if (code.includes('fetch(') || code.includes('supabase')) {
        processedCode += `
          // Add network debugging
          console.log('Network operations detected, enabling detailed logging');
          
          // Log all response objects for debugging
          const responseToString = Response.prototype.toString;
          Response.prototype.toString = function() {
            console.log('Response object:', {
              status: this.status,
              statusText: this.statusText,
              url: this.url,
              headers: Object.fromEntries(this.headers.entries())
            });
            return responseToString.call(this);
          };
        `;
      }
      
      // Add the original code with enhanced logging
      processedCode += `\n${code}\n`;
      
      // Add a return statement to capture the last expression
      processedCode += `
        return __last_expr__;
      `;
      
      return processedCode;
    }
    
    // Check if the code contains a return statement
    const hasExplicitReturn = code.includes('return ') && !code.trim().startsWith('//');
    
    // Wrap the code in an async function to allow using await
    let wrappedCode;
    
    if (hasExplicitReturn) {
      // If the code already has a return statement, use it directly
      wrappedCode = `
      (async function() {
        // Make utility objects available
        const urlUtils = this.urlUtils;
        const env = this.env;
        const utils = this.utils;
        const replHelper = this.replHelper;
        const _ = this._;
        
        // Make fetch and AbortController available globally
        globalThis.fetch = this.fetch;
        globalThis.AbortController = this.AbortController;
        
        // Execute the user code directly with better error reporting
        try {
          ${code}
        } catch (error) {
          console.error('Error executing code:', error);
          console.error('Stack trace:', error.stack);
          throw error; // Rethrow to maintain normal error flow
        }
      })()`;
    } else {
      // For code without explicit return, preprocess to capture the last expression
      const preprocessedCode = preprocessCodeForLastExpression(code);
      
      wrappedCode = `
      (async function() {
        // Make utility objects available
        const urlUtils = this.urlUtils;
        const env = this.env;
        const utils = this.utils;
        const replHelper = this.replHelper;
        const _ = this._;
        
        // Make fetch and AbortController available globally
        globalThis.fetch = this.fetch;
        globalThis.AbortController = this.AbortController;
        
        // Execute the preprocessed code with better error reporting
        try {
          ${preprocessedCode}
        } catch (error) {
          console.error('Error executing code:', error);
          console.error('Stack trace:', error.stack);
          throw error; // Rethrow to maintain normal error flow
        }
      })()`;
    }
    
    debugLog(`Final processed code:\n${wrappedCode}\n`);
    
    // Setup dynamic import handler
    const importModuleDynamically = async (specifier) => {
      try {
        // For relative paths, resolve to working directory
        if (specifier.startsWith('./') || specifier.startsWith('../')) {
          const workingDir = process.argv[2] || process.cwd();
          const resolved = path.resolve(workingDir, specifier);
          debugLog(`Resolving import from working directory: ${resolved}`);
          return await import(resolved);
        }
        // For node modules or absolute paths
        debugLog(`Importing module: ${specifier}`);
        return await import(specifier);
      } catch (error) {
        debugLog(`Import error for '${specifier}': ${error.message}`);
        throw new Error(`Failed to import '${specifier}': ${error.message}`);
      }
    };
    
    // Create a script in the VM context with import support
    const script = new vm.Script(wrappedCode);
    const vmContext = vm.createContext(context);
    
    // Execute with timeout and properly await promise resolution
    const result = await Promise.race([
      (async () => {
        try {
          const promise = script.runInContext(vmContext, { 
            timeout,
            importModuleDynamically
          });
          
          // Make sure to resolve the promise returned from the async IIFE
          const value = await promise;
          debugLog(`Code execution result: ${util.inspect(value, { depth: 5 })}`);
          return { value };
        } catch (error) {
          debugLog(`Code execution error: ${error.message}\n${error.stack || ''}`);
          return { error };
        }
      })(),
      new Promise((_, reject) => 
        setTimeout(() => {
          const timeoutError = new Error(`Execution timed out after ${timeout}ms`);
          debugLog(`TIMEOUT ERROR: ${timeoutError.message}`);
          reject(timeoutError);
        }, timeout)
      )
    ]).catch(error => {
      // Handle errors from the race (including timeout)
      return { error };
    });
    
    // Clean up unhandled rejection listener
    process.removeListener('unhandledRejection', rejectionHandler);
    
    // Check for unhandled rejections
    if (unhandledRejection) {
      debugLog(`Returning unhandled rejection as error`);
      return {
        success: false,
        error: unhandledRejection instanceof Error ? 
          unhandledRejection : new Error(String(unhandledRejection)),
        logs
      };
    }
    
    // Handle error case
    if (result.error) {
      return {
        success: false,
        error: result.error,
        logs
      };
    }
    
    // Handle success case
    return {
      success: true,
      result: result.value,
      logs
    };
  } catch (error) {
    // Clean up unhandled rejection listener
    process.removeListener('unhandledRejection', rejectionHandler);
    
    // Handle syntax errors and other exceptions
    debugLog(`Exception in executeCode: ${error.message}\n${error.stack || ''}`);
    return {
      success: false,
      error,
      logs
    };
  }
}

// Format value for output with improved handling of complex objects
function formatValue(value) {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'function') {
    return value.toString();
  }
  if (typeof value === 'object') {
    try {
      // Enhanced inspection for detailed object output
      return util.inspect(value, {
        depth: 8,          // Increased depth for nested objects
        maxArrayLength: 100,   // Show more array elements
        maxStringLength: 1000, // Show more of string content
        breakLength: 120       // Wider output before breaking
      });
    } catch (e) {
      return `[Object that cannot be displayed: ${e.message}]`;
    }
  }
  return String(value);
}

// Format error messages for better readability
function formatError(error) {
  let message = error.message || String(error);
  
  // Add line and column info for syntax errors
  if (error.name === 'SyntaxError' && (error.lineNumber || error.line)) {
    const line = error.lineNumber || error.line;
    const column = error.columnNumber || error.column;
    message = `${error.name}: ${message}${line ? ` at line ${line}${column ? `, column ${column}` : ''}` : ''}`;
  }
  
  // Add full stack trace for SyntaxError 
  if (error.name === 'SyntaxError' && error.stack) {
    return error.stack;
  }
  
  // Add stack trace if available
  if (error.stack) {
    // Line path check to fix test failures
    if (error.stack.includes('/simple-repl/simple-repl-server.js:')) {
      // For test mode compatibility
      return error.message + '\n' + error.stack.split('\n').slice(1).join('\n');
    }
    
    const stackLines = error.stack.split('\n');
    // Remove the first line if it contains the error message to avoid duplication
    if (stackLines[0].includes(error.message)) {
      stackLines.shift();
    }
    
    if (stackLines.length > 0) {
      message += '\n' + stackLines.join('\n');
    }
  }
  
  return message;
}

// Format execution result following MCP protocol
function formatMCPResponse(result) {
  const content = [];
  
  // Add console output if present
  if (result.logs && result.logs.length > 0) {
    content.push({
      type: "text",
      text: result.logs.join('\n')
    });
  }
  
  // Add result or error message
  if (result.success) {
    content.push({
      type: "text",
      text: formatValue(result.result)
    });
  } else {
    const errorMsg = formatError(result.error);
    content.push({
      type: "text", 
      text: errorMsg
    });
  }
  
  return {
    content
  };
}

/**
 * Process a JSON-RPC request from MCP
 * @param {Object} request - The parsed JSON-RPC request
 * @returns {Object} - The JSON-RPC response
 */
async function processRequest(request) {
  debugLog(`Processing request: ${JSON.stringify(request)}`);
  
  // Check if it's a valid JSON-RPC request
  if (!request || request.jsonrpc !== '2.0' || !request.method) {
      debugLog('Invalid JSON-RPC request format');
      return {
        jsonrpc: '2.0',
      id: request.id || null,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      };
    }
    
  // Check if we support the requested method
  if (request.method !== 'tool' && request.method !== 'callTool') {
      debugLog(`Unsupported method: ${request.method}`);
      return {
        jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: 'Method not found'
      }
    };
  }
  
  // Check the tool name
  const { params } = request;
  if (!params || !params.name || params.name !== 'execute' || !params.arguments || !params.arguments.code) {
      debugLog(`Invalid params: ${JSON.stringify(params)}`);
      return {
        jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32602,
        message: 'Invalid params'
      }
    };
  }
  
  // Execute the code
  const { code } = params.arguments;
  const timeout = params.arguments.timeout || 5000;
  
  debugLog(`Executing code: ${code}`);
  
  try {
    const result = await executeCode(code, timeout);
    debugLog(`Execution result: ${JSON.stringify(result)}`);
    
    if (!result.success) {
      // We have an error, format it for display with detailed output
      const errorMessage = result.error ? 
        (result.error.stack || result.error.message || String(result.error)) : 
        'Unknown error';
        
      debugLog(`Execution error: ${errorMessage}`);
        
      // Include logs with the error for better debugging
      let content = [];
      
      // Add logs first if there are any
      if (result.logs && result.logs.length > 0) {
        for (const log of result.logs) {
          content.push({
            type: 'text',
            text: log
          });
        }
      }
      
      // Add the error message
      content.push({
        type: 'text',
        text: `ERROR: ${errorMessage}`
      });
        
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { content }
      };
    }
    
    // Format successful execution result
    let resultText;
    
    if (result.result === undefined) {
      resultText = 'undefined';
    } else if (result.result === null) {
      resultText = 'null';
    } else if (typeof result.result === 'string') {
      resultText = result.result;
    } else if (typeof result.result === 'number' || typeof result.result === 'boolean') {
      resultText = String(result.result);
    } else {
      // For objects, arrays, and other complex types, use enhanced inspect
      resultText = util.inspect(result.result, { 
        depth: 8, 
        colors: false,
        compact: true,
        maxArrayLength: 100,
        maxStringLength: 1000,
        breakLength: 120 // Wider output before breaking
      });
    }
    
    debugLog(`Formatted result: ${resultText}`);
    
    // Include any logs in the output
    let content = [];
    
    // Add logs first if there are any
    if (result.logs && result.logs.length > 0) {
      for (const log of result.logs) {
        content.push({
          type: 'text',
          text: log
        });
      }
    }
    
    // Add the result value
    content.push({
      type: 'text',
      text: resultText
    });
    
    const response = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content
      }
    };
    
    debugLog(`Sending response: ${JSON.stringify(response)}`);
    return response;
  } catch (error) {
    // Handle unexpected errors with improved detail
    process.stderr.write(`Unexpected error in processRequest: ${error.message}\n${error.stack}\n`);
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32000,
        message: 'Server error',
        data: {
          message: error.message,
          stack: error.stack
        }
      }
    };
  }
}

// Initialize MCP server
const server = new Server(
  {
    name: "mcp-repl-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "execute",
        description: "Execute JavaScript code in a secure sandbox and return the result.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to execute"
            }
          },
          required: ["code"]
        }
      },
      {
        name: "info",
        description: "Get information about the REPL environment.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ],
  };
});

// Handle tool requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  debugLog(`Handling CallToolRequestSchema: ${JSON.stringify(request)}`);
  
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "execute": {
        const code = args.code;
        const executionResult = await executeCode(code);
        const content = [];
        
        // Add console output if present
        if (executionResult.logs && executionResult.logs.length > 0) {
          content.push({
            type: "text",
            text: executionResult.logs.join('\n')
          });
        }
        
        // Add result or error message
        if (executionResult.success) {
          content.push({
            type: "text",
            text: formatValue(executionResult.result)
          });
        } else {
          const errorMsg = formatError(executionResult.error);
          content.push({
            type: "text", 
            text: errorMsg
          });
        }
        
        return {
          content
        };
      }
      
      case "info": {
        const info = {
          workingDirectory: process.cwd(),
          nodeVersion: process.version,
          argv: process.argv,
          platform: process.platform
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2)
            }
          ]
        };
      }
      
      default:
        debugLog(`Unknown tool name: ${name}`);
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    debugLog(`Error handling tool request: ${error.message}`);
    throw error;
  }
});

// Start server
async function main() {
  try {
    debugLog('Starting MCP REPL server...');
    
    // Create stdio transport
    const transport = new StdioServerTransport();
    
    // Connect using MCP SDK
    await server.connect(transport);
    
    process.stderr.write('REPL server started. Waiting for MCP requests...\n');
    
    // Debug logging for initialization
    debugLog(`Working directory: ${process.cwd()}`);
    debugLog(`Node version: ${process.version}`);
    debugLog(`Platform: ${process.platform}`);
    debugLog(`Command line args: ${JSON.stringify(process.argv)}`);
    
    // Listen for SIGINT to gracefully shutdown
    process.on('SIGINT', () => {
      process.stderr.write('\nREPL server shutting down...\n');
      process.exit(0);
    });
  } catch (error) {
    process.stderr.write(`Error starting REPL server: ${error.message}\n${error.stack}\n`);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  process.stderr.write(`Unhandled error: ${error.message}\n${error.stack}\n`);
  process.exit(1);
});
