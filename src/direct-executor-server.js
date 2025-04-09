#!/usr/bin/env node
// Simple Node.js direct executor server using MCP SDK

import * as path from 'node:path';
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js"; 
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from 'fs';
import { exec } from 'child_process';
import { debugLog } from './utils.js';

// Get the working directory from command line or use current directory
const defaultWorkingDir = process.argv[2] 
    ? path.resolve(process.argv[2]) 
    : process.cwd();

console.log(`Starting direct executor with working directory: ${defaultWorkingDir}`);

// Initialize the MCP server
const server = new McpServer(
  {
    name: "direct-node-executor", 
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // Enable tool support
    },
  }
);

// List available tools
const listToolsHandler = async () => {
  return {
    tools: [
      {
        name: "execute",
        description: "Execute JavaScript code directly with Node.js - supports ESM imports and all Node.js features",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "JavaScript code to execute"
            },
            timeout: {
              type: "number",
              description: "Optional timeout in milliseconds (default: 5000)"
            },
            workingDir: {
              type: "string",
              description: "Optional working directory override"
            }
          },
          required: ["code"]
        }
      }
    ],
  };
};

// Execute code function
const executeCode = async (code, timeout = 5000, workingDir = defaultWorkingDir) => {
  // Create a timestamp function for logging
  const timestamp = () => `[${new Date().toISOString()}]`;
  const capturedLogs = [];
  const startTime = Date.now();
  
  // Create a temporary directory for execution
  const tempDir = path.join(workingDir, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create a unique temporary file for execution
  const tempFile = path.join(tempDir, `node-exec-${Date.now()}-${Math.random().toString(36).substring(2)}.mjs`);
  
  // Wrap code to capture console output and return values
  const wrappedCode = `
// Capture start time
const __startTime = Date.now();

// Store original console methods
const __originalConsole = { ...console };

// Capture logs
const __logs = [];

// Override console methods to capture output
console.log = (...args) => {
  const formatted = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  __logs.push(formatted);
  __originalConsole.log(...args);
};

console.error = (...args) => {
  const formatted = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  __logs.push('ERROR: ' + formatted);
  __originalConsole.error(...args);
};

console.warn = (...args) => {
  const formatted = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  __logs.push('WARNING: ' + formatted);
  __originalConsole.warn(...args);
};

// Add execution info to logs
__logs.push('${timestamp()} Running in Node.js with direct execution');

// Store the result of the code execution
let __result;

// Use an async IIFE to allow top-level await
(async () => {
  try {
    // Execute the user code
    __result = await (async () => {
${code}
    })();
  } catch (error) {
    __logs.push('${timestamp()} Execution error: ' + error.message);
    if (error.stack) {
      __logs.push('Stack trace: ' + error.stack.split('\\n').slice(0, 3).join('\\n'));
    }
    __result = { error: error.message };
  } finally {
    // Calculate execution time
    const __endTime = Date.now();
    const __duration = __endTime - __startTime;
    const __memory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    __logs.push('${timestamp()} Execution completed in ' + __duration + 'ms (Memory: ' + Math.round(__memory * 100) / 100 + 'MB)');
    
    // Print results as JSON for easy parsing
    __originalConsole.log('__EXEC_RESULT_START__');
    __originalConsole.log(JSON.stringify({
      success: true,
      result: __result,
      logs: __logs,
      executionTimeMs: __duration,
      memoryUsageMB: Math.round(__memory * 100) / 100
    }));
    __originalConsole.log('__EXEC_RESULT_END__');
  }
})();
`;

  try {
    // Write the code to the temporary file
    fs.writeFileSync(tempFile, wrappedCode, 'utf8');
    
    return new Promise((resolve) => {
      capturedLogs.push(`${timestamp()} Executing code with Node.js...`);
      
      // Execute with Node.js
      const nodeProcess = exec(
        `node --experimental-modules --no-warnings ${tempFile}`,
        { 
          cwd: workingDir,
          timeout,
          env: process.env
        }
      );
      
      let stdout = '';
      let stderr = '';
      
      nodeProcess.stdout.on('data', (data) => {
        stdout += data;
      });
      
      nodeProcess.stderr.on('data', (data) => {
        stderr += data;
        // Add stderr to captured logs
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            capturedLogs.push(`ERROR: ${line}`);
          }
        });
      });
      
      nodeProcess.on('close', (code) => {
        // Calculate execution time
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
        } catch (err) {
          capturedLogs.push(`${timestamp()} Failed to clean up temporary file: ${err.message}`);
        }
        
        if (code !== 0) {
          capturedLogs.push(`${timestamp()} Process exited with code ${code}`);
          resolve({
            success: false,
            error: `Process exited with code ${code}`,
            logs: capturedLogs.concat(stderr.split('\n').filter(Boolean))
          });
          return;
        }
        
        // Extract execution result from stdout
        try {
          const resultMatches = stdout.match(/__EXEC_RESULT_START__\n([\s\S]*?)\n__EXEC_RESULT_END__/);
          if (resultMatches && resultMatches[1]) {
            const resultJson = JSON.parse(resultMatches[1]);
            // Combine any logs from the execution with our own logs
            resultJson.logs = capturedLogs.concat(resultJson.logs || []);
            resolve(resultJson);
          } else {
            capturedLogs.push(`${timestamp()} Execution completed in ${duration}ms`);
            resolve({
              success: true,
              result: stdout,
              logs: capturedLogs
            });
          }
        } catch (parseError) {
          capturedLogs.push(`${timestamp()} Error parsing execution result: ${parseError.message}`);
          resolve({
            success: false,
            error: `Error parsing execution result: ${parseError.message}`,
            logs: capturedLogs,
            rawOutput: stdout
          });
        }
      });
      
      nodeProcess.on('error', (err) => {
        capturedLogs.push(`${timestamp()} Execution error: ${err.message}`);
        
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
        } catch (cleanupErr) {
          capturedLogs.push(`${timestamp()} Failed to clean up temporary file: ${cleanupErr.message}`);
        }
        
        resolve({
          success: false,
          error: err.message,
          logs: capturedLogs
        });
      });
    });
  } catch (err) {
    capturedLogs.push(`${timestamp()} Error setting up execution: ${err.message}`);
    return {
      success: false,
      error: err.message,
      logs: capturedLogs
    };
  }
};

// Handle code execution requests
const callToolHandler = async (request) => {
  try {
    const { name, arguments: args = {} } = request.params;
    
    if (name === 'execute' || name === 'mcp_mcp_repl_execute') {
      const { code, timeout = 5000, workingDir = defaultWorkingDir } = args;
      
      if (!code) {
        throw new Error("Missing code argument for execute tool");
      }
      
      // Execute the code with Node.js
      const result = await executeCode(code, timeout, workingDir);
      
      // Format the logs for MCP response
      const formattedLogs = result.logs.map(log => ({
        type: 'text',
        text: log
      }));
      
      // Format the execution result for MCP response
      let resultValue;
      if (result.success) {
        if (result.result === undefined) {
          resultValue = 'undefined';
        } else if (result.result === null) {
          resultValue = 'null';
        } else if (typeof result.result === 'object') {
          try {
            resultValue = JSON.stringify(result.result, null, 2);
          } catch (e) {
            resultValue = `[Object: ${e.message}]`;
          }
        } else {
          resultValue = String(result.result);
        }
      } else {
        resultValue = `ERROR: ${result.error}`;
      }
      
      return {
        content: [
          ...formattedLogs,
          {
            type: 'text',
            text: resultValue
          }
        ]
      };
    }
    
    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `ERROR: ${error.message}`
        }
      ]
    };
  }
};

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);
server.setRequestHandler(CallToolRequestSchema, callToolHandler);

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error(`UNCAUGHT EXCEPTION: ${err.message}`);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error(`UNHANDLED REJECTION: ${reason}`);
});

// Start the server
async function main() {
  try {
    // Create transport and connect
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    
    console.error('Direct Node.js executor server started. Waiting for MCP requests...');
  } catch (error) {
    console.error(`Error starting server: ${error.message}`);
    process.exit(1);
  }
}

// Run the server
main(); 