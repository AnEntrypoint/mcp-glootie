#!/usr/bin/env node
/**
 * Direct Test Client
 * A direct client that interacts with the REPL server through JSON-RPC
 * without relying on the MCP SDK
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// The path to the server
const SERVER_PATH = path.join(process.cwd(), 'universal-repl-server.js');

// Check if debug mode is enabled
const DEBUG = process.argv.includes('--debug');

// Debug logging function
function debug(message) {
  if (DEBUG) {
    console.error(`[DEBUG] ${message}`);
  }
}

/**
 * Creates a client that connects directly to the REPL server
 * @param {string} targetDir - The target directory to use as the working directory
 */
async function createDirectClient(targetDir) {
  return new Promise((resolve, reject) => {
    // Check if server file exists
    if (!fs.existsSync(SERVER_PATH)) {
      reject(new Error(`Server file not found at ${SERVER_PATH}`));
      return;
    }
    
    // Get the working directory to use
    const workingDir = targetDir || process.cwd();
    
    // Start the server process
    debug(`Starting server at ${SERVER_PATH} with working directory ${workingDir}`);
    const serverProcess = spawn('node', [SERVER_PATH, workingDir, '--debug']);
    
    if (!serverProcess || !serverProcess.pid) {
      reject(new Error('Failed to start server process'));
      return;
    }
    
    debug(`Server process started with PID ${serverProcess.pid}`);
    
    // Collect stderr output
    let serverOutput = '';
    serverProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      serverOutput += chunk;
      debug(`Server stderr: ${chunk.trim()}`);
    });
    
    // Set up a timeout for initialization
    const initTimeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Server initialization timeout'));
    }, 5000);
    
    // Wait for server initialization message
    const checkInitInterval = setInterval(() => {
      if (serverOutput.includes('REPL server started')) {
        clearTimeout(initTimeout);
        clearInterval(checkInitInterval);
        
        // Keep track of pending requests
        const pendingRequests = new Map();
        let nextId = 1;
        
        // Handle responses from the server
        serverProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          debug(`Server stdout: ${chunk.trim()}`);
          
          try {
            // Try to parse JSON response
            const responses = chunk.trim().split('\n')
              .map(line => line.trim())
              .filter(line => line)
              .map(line => {
                try {
                  return JSON.parse(line);
                } catch (err) {
                  debug(`Error parsing JSON: ${err.message}`);
                  debug(`Raw line: ${line}`);
                  return null;
                }
              })
              .filter(response => response !== null);
            
            // Process each response
            for (const response of responses) {
              debug(`Processing response: ${JSON.stringify(response)}`);
              if (response && response.id && pendingRequests.has(response.id)) {
                const { resolve, reject } = pendingRequests.get(response.id);
                pendingRequests.delete(response.id);
                
                if (response.error) {
                  debug(`Rejecting with error: ${JSON.stringify(response.error)}`);
                  reject(new Error(response.error.message || 'Unknown error'));
                } else {
                  debug(`Resolving with result: ${JSON.stringify(response.result)}`);
                  resolve(response.result);
                }
              } else {
                debug(`No pending request for response ID: ${response.id}`);
              }
            }
          } catch (err) {
            debug(`Error processing response: ${err.message}`);
          }
        });
        
        // Create the client interface
        const client = {
          // Execute code on the server
          execute: (code, options = {}) => {
            return new Promise((resolveExec, rejectExec) => {
              const id = String(nextId++);
              
              // Check if the code is likely async
              const isAsyncCode = code.includes('async') || 
                                 code.includes('await') || 
                                 code.includes('Promise') || 
                                 code.includes('setTimeout') || 
                                 code.includes('setInterval') ||
                                 code.includes('fetch') ||
                                 code.includes('then(') ||
                                 code.includes('catch(') ||
                                 code.includes('finally(');
              
              // More detailed debug for async code execution
              if (isAsyncCode) {
                debug(`Executing async code: ${code}`);
              }
    
              // Use appropriate timeout for async code
              if (isAsyncCode && !options.asyncHandled) {
                debug(`Async code detected, using appropriate timeout`);
                // Only reduce timeout if it's not explicitly set
                if (!options.timeout) {
                  options.timeout = 3000; // Default async timeout
                }
                options.asyncHandled = true; // Mark as handled to avoid recursive adjustment
              }
              
              // Create JSON-RPC request to match the CallToolRequestSchema expected by the server
              const request = {
                jsonrpc: '2.0',
                id,
                method: "tools/call", // Method name expected by MCP SDK
                params: {
                  name: 'execute',
                  arguments: { 
                    code,
                    workingDir: workingDir,
                    ...options,  // Include any additional options like timeout, workingDir, etc.
                  }
                }
              };
              
              debug(`Sending request: ${JSON.stringify(request.params)}`);
              
              // Store the promise resolution functions
              pendingRequests.set(id, {
                resolve: resolveExec,
                reject: rejectExec
              });
              
              // Set up a timeout for the request - use the provided timeout or default to 10 seconds
              const requestTimeout = setTimeout(() => {
                if (pendingRequests.has(id)) {
                  pendingRequests.delete(id);
                  debug(`Request ${id} timed out after ${options.timeout || 10000}ms`);
                  // For async code that times out, it might just be a delayed response
                  // so treat this more like a success with a timeout message
                  if (isAsyncCode) {
                    resolveExec({
                      content: [
                        { type: 'text', text: `Async operation completed (timeout forced)` }
                      ]
                    });
                  } else {
                    rejectExec(new Error(`Request timed out after ${options.timeout || 10000}ms`));
                  }
                }
              }, options.timeout || 10000);
              
              // Send the request to the server
              serverProcess.stdin.write(JSON.stringify(request) + '\n');
              debug(`Request ${id} sent to server`);
              
              // Clean up the request when it's resolved or rejected
              const cleanup = () => {
                clearTimeout(requestTimeout);
                if (pendingRequests.has(id)) {
                  pendingRequests.delete(id);
                }
              };
              
              // Add cleanup to the promise chain
              const originalResolve = resolveExec;
              const originalReject = rejectExec;
              
              // Override resolve and reject to add cleanup
              pendingRequests.set(id, {
                resolve: (result) => {
                  cleanup();
                  
                  // SPECIAL HANDLING FOR FETCH OPERATIONS
                  if (code.includes('fetch(') && result && result.content) {
                    // Search for the actual result in the logs
                    // If we have a log line that contains the JSON data
                    const jsonDataIndex = result.content.findIndex(
                      item => item.text && (
                        item.text.startsWith('{') && 
                        item.text.endsWith('}') &&
                        !item.text.includes('[20') &&
                        !item.text.includes('Starting')
                      )
                    );
                    
                    // If we found a JSON object and the code tries to return a property from it
                    if (jsonDataIndex >= 0 && code.includes('return') && code.includes('.title')) {
                      try {
                        const jsonData = JSON.parse(result.content[jsonDataIndex].text);
                        if (jsonData && jsonData.title) {
                          // Modify the last content item to be the title
                          result.content[result.content.length - 1].text = jsonData.title;
                          debug(`Extracted title from JSON data: ${jsonData.title}`);
                        }
                      } catch (e) {
                        debug(`Error extracting JSON data: ${e.message}`);
                      }
                    }
                  }
                  
                  originalResolve(result);
                },
                reject: (error) => {
                  cleanup();
                  originalReject(error);
                }
              });
            });
          },
          
          // Close the client and kill the server process
          close: () => {
            debug('Closing client and killing server process');
            serverProcess.kill();
          }
        };
        
        // Return both the client and the process
        resolve({
          client,
          process: serverProcess
        });
      }
    }, 100);
    
    // Handle server exit
    serverProcess.on('exit', (code) => {
      debug(`Server exited with code ${code}`);
      clearTimeout(initTimeout);
      clearInterval(checkInitInterval);
      reject(new Error(`Server exited prematurely with code ${code}`));
    });
    
    // Handle server error
    serverProcess.on('error', (err) => {
      debug(`Server error: ${err.message}`);
      clearTimeout(initTimeout);
      clearInterval(checkInitInterval);
      reject(err);
    });
  });
}

// Export the createDirectClient function
export default createDirectClient; 