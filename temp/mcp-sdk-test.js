#!/usr/bin/env node
/**
 * MCP SDK Test
 * A simple test script to verify MCP SDK works with the REPL server
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Check if debug mode is enabled
const DEBUG = process.argv.includes('--debug');

// Debug logging function
function debug(message) {
  if (DEBUG) {
    console.log(`[DEBUG] ${message}`);
  }
}

// Server path
const SERVER_PATH = path.join(process.cwd(), 'universal-repl-server.js');

async function runTest() {
  // Check if server exists
  if (!fs.existsSync(SERVER_PATH)) {
    console.error(`Server not found: ${SERVER_PATH}`);
    process.exit(1);
  }
  
  console.log('Starting server process...');
  
  // Start server process
  const serverProcess = spawn('node', [SERVER_PATH, '--debug']);
  
  if (!serverProcess || !serverProcess.pid) {
    console.error('Failed to start server process');
    process.exit(1);
  }
  
  console.log(`Server started with PID: ${serverProcess.pid}`);
  
  // Set up a timeout to wait for server
  let serverReady = false;
  
  // Listen for server initialization
  serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    debug(`Server stderr: ${output.trim()}`);
    
    // Mark server as ready when we see the ready message
    if (!serverReady && output.includes('REPL server started')) {
      serverReady = true;
      debug('Server is ready!');
      
      // Connect when server is ready
      connectClient(serverProcess);
    }
  });
  
  // Handle server exit
  serverProcess.on('exit', (code) => {
    if (!serverReady) {
      console.error(`Server exited before initialization with code: ${code}`);
      process.exit(1);
    }
  });
  
  // Set timeout for server start
  setTimeout(() => {
    if (!serverReady) {
      console.error('Server initialization timeout');
      serverProcess.kill();
      process.exit(1);
    }
  }, 5000);
}

async function connectClient(serverProcess) {
  console.log('Creating MCP client...');
  
  try {
    // Initialize the MCP SDK's client
    const client = new Client({
      rpcOptions: {
        timeout: 10000,
      },
    });
    
    // Connect client to server
    // IMPORTANT NOTE: In NodeJS the process.stdin/stdout are already connected
    // to the terminal, so we need to create a transport connected to the child process
    debug('Connecting transport to server process...');
    
    // Create transport
    const transport = new StdioClientTransport(serverProcess.stdin, serverProcess.stdout);
    
    // Connect client to transport
    debug('Connecting client to transport...');
    await client.connect(transport);
    
    console.log('Client connected successfully!');
    
    // List available tools
    const tools = await client.listTools();
    console.log(`Server has ${tools.tools.length} tool(s):`);
    tools.tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    
    // Run a simple code execution test
    console.log('\nRunning test: 2 + 2');
    const result = await client.callTool({
      name: 'execute',
      arguments: { code: '2 + 2' }
    });
    
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\nTest completed successfully');
    
    // Clean up
    try {
      await client.disconnect();
    } catch (err) {
      debug(`Error disconnecting client: ${err.message}`);
    }
    
    serverProcess.kill();
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    debug(`Stack: ${error.stack}`);
    serverProcess.kill();
    process.exit(1);
  }
}

// Run the test
runTest(); 