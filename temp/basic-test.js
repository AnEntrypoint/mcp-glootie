#!/usr/bin/env node
// Simple MCP Test for a single file

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Debug mode
const DEBUG = true;

// Debug log function
function debug(msg) {
  if (DEBUG) {
    console.log(`[DEBUG] ${msg}`);
  }
}

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Path to server and test file
const SERVER_PATH = path.join(rootDir, 'universal-repl-server.js');
const TEST_FILE = path.join(rootDir, 'tests', 'basic.js');

console.log(`Server path: ${SERVER_PATH} (exists: ${fs.existsSync(SERVER_PATH)})`);
console.log(`Test file: ${TEST_FILE} (exists: ${fs.existsSync(TEST_FILE)})`);

// Basic test data
const BASIC_TEST = {
  name: "Basic Addition Test",
  code: "2 + 2",
  expected: "4"
};

// Start MCP server and create client
async function createMCPClient() {
  try {
    // Use absolute resolved path for the server
    const serverPath = path.resolve(SERVER_PATH);
    debug(`Starting server at resolved path: ${serverPath}`);
    
    // Start the server process with explicit stdio configuration
    const serverProcess = spawn('node', [serverPath, '--debug'], {
      stdio: ['pipe', 'pipe', 'pipe'] // Important: This format is required for StdioClientTransport
    });
    
    if (!serverProcess || !serverProcess.pid) {
      throw new Error(`Failed to start server process`);
    }
    
    debug(`Server process started with PID: ${serverProcess.pid}`);
    
    // Log stderr output
    serverProcess.stderr.on('data', (data) => {
      const chunk = data.toString().trim();
      if (chunk) debug(`Server stderr: ${chunk}`);
    });
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create MCP client transport with the server process
    const transport = new StdioClientTransport(serverProcess);
    
    // Create and connect the client
    const client = new Client();
    
    try {
      await Promise.race([
        client.connect(transport),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000)
        )
      ]);
      debug(`Client connected successfully`);
    } catch (err) {
      debug(`Connection error: ${err.message}`);
      serverProcess.kill();
      throw err;
    }
    
    // Return client and close method
    return {
      client,
      close: async () => {
        debug('Closing client and server');
        try {
          await client.close();
        } catch (e) {
          debug(`Error closing client: ${e.message}`);
        }
        
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill();
          debug('Server process killed');
        }
      }
    };
  } catch (err) {
    debug(`Error creating client: ${err.message}`);
    throw err;
  }
}

// Run a single test
async function runTest(test) {
  try {
    console.log(`Running test: ${test.name}`);
    
    // Create client
    const clientWrapper = await createMCPClient();
    
    try {
      // Call the execute tool
      const response = await clientWrapper.client.callTool({
        name: 'execute',
        arguments: { code: test.code }
      });
      
      debug(`Response from server: ${JSON.stringify(response)}`);
      
      // Extract text content
      const textItems = response.content
        .filter(item => item && item.type === 'text')
        .map(item => item.text || '');
      
      // Get the last item as the result
      const result = textItems.length > 0 ? textItems[textItems.length - 1] : '';
      
      // Compare with expected value
      const pass = result.includes(test.expected);
      
      if (pass) {
        console.log(`✅ Test passed! Got: ${result}`);
      } else {
        console.log(`❌ Test failed! Expected: ${test.expected}, Got: ${result}`);
      }
      
      return pass;
    } finally {
      // Close the client
      await clientWrapper.close();
    }
  } catch (err) {
    console.error(`Error running test: ${err.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('=== Basic MCP Test Runner ===\n');
  
  try {
    // Run the basic test
    const passed = await runTest(BASIC_TEST);
    console.log(`\nTest ${passed ? 'PASSED' : 'FAILED'}`);
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error(`Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

// Run the test
main(); 