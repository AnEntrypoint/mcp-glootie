#!/usr/bin/env node

/**
 * Simple debug script for the REPL server
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Path to the test server
const TEMP_SERVER_PATH = path.join(__dirname, 'temp-test-server.cjs');

// Run a simple test
async function runTest() {
  console.log('Starting debug test...');
  
  if (!fs.existsSync(TEMP_SERVER_PATH)) {
    console.error(`Server file not found at ${TEMP_SERVER_PATH}`);
    process.exit(1);
  }
  
  // Create server process
  const server = spawn('node', [TEMP_SERVER_PATH, '--debug']);
  
  // Simple JSON-RPC request for addition test
  const request = {
    jsonrpc: '2.0',
    id: '1',
    method: 'callTool',
    params: {
      name: 'execute',
      arguments: {
        code: 'return 2 + 2'
      }
    }
  };
  
  let responseData = '';
  let errorData = '';
  
  // Collect stdout
  server.stdout.on('data', (data) => {
    const chunk = data.toString();
    console.log(`Server stdout: ${chunk}`);
    responseData += chunk;
    
    // Check if we have a complete JSON-RPC response
    if (chunk.includes('"jsonrpc":"2.0"') && chunk.includes('"id":"1"')) {
      try {
        const response = JSON.parse(chunk);
        console.log('Parsed response:', JSON.stringify(response, null, 2));
        
        if (response.result && response.result.content) {
          const content = response.result.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
          
          console.log('Test result:', content);
          
          if (content === '4') {
            console.log('TEST PASSED!');
          } else {
            console.log('TEST FAILED - Expected: 4, Got:', content);
          }
        }
        
        // Kill the server after getting the response
        server.kill();
      } catch (e) {
        console.error('Error parsing response:', e.message);
      }
    }
  });
  
  // Collect stderr
  server.stderr.on('data', (data) => {
    const chunk = data.toString();
    console.log(`Server stderr: ${chunk}`);
    errorData += chunk;
  });
  
  // Handle server exit
  server.on('exit', (code) => {
    console.log(`Server exited with code: ${code}`);
    if (code !== 0) {
      console.error('Server error output:', errorData);
    }
    process.exit(code || 0);
  });
  
  // Wait for server to start
  setTimeout(() => {
    console.log('Sending request:', JSON.stringify(request));
    server.stdin.write(JSON.stringify(request) + '\n');
  }, 1000);
}

// Run the test
runTest(); 