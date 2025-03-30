#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the REPL server
const SERVER_PATH = path.join(__dirname, '..', 'simple-repl-server.js');

async function testSimpleAddition() {
  console.log('Running basic test...');
  
  return new Promise((resolve) => {
    // Start the REPL server process with debugging
    const server = spawn('node', [SERVER_PATH, '--debug'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let stderrOutput = '';
    
    // Collect stdout
    server.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log(`Server stdout: ${chunk}`);
    });
    
    // Collect stderr
    server.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;
      console.log(`Server stderr: ${chunk}`);
    });
    
    // Create MCP request
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
    
    // Send the request to the server
    console.log(`Sending request: ${JSON.stringify(request)}`);
    server.stdin.write(JSON.stringify(request) + '\n');
    server.stdin.end();
    
    // When the server exits, check the response
    server.on('close', () => {
      console.log(`Server exited. Full output: ${output}`);
      console.log(`Server stderr: ${stderrOutput}`);
      
      try {
        const lines = output.split('\n');
        let jsonResponse = null;
        
        for (const line of lines) {
          if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
            try {
              const parsed = JSON.parse(line.trim());
              if (parsed.jsonrpc === '2.0') {
                jsonResponse = parsed;
                console.log(`Found JSON-RPC response: ${JSON.stringify(parsed)}`);
                break;
              }
            } catch (e) {
              // Not valid JSON, continue to next line
            }
          }
        }
        
        if (!jsonResponse) {
          console.error(`❌ FAILED: No valid JSON-RPC response`);
          resolve(false);
          return;
        }
        
        if (jsonResponse.error) {
          console.error(`❌ FAILED: Server returned an error: ${jsonResponse.error.message}`);
          resolve(false);
          return;
        }
        
        const result = jsonResponse.result;
        if (!result || !result.content) {
          console.error(`❌ FAILED: Missing content in response`);
          console.error(`Response: ${JSON.stringify(jsonResponse)}`);
          resolve(false);
          return;
        }
        
        // Combine all content pieces to check for expected values
        let responseText = '';
        
        for (const content of result.content) {
          if (content.text) {
            responseText += content.text + '\n';
          }
        }
        
        console.log(`Response text: ${responseText}`);
        
        if (responseText.includes('4')) {
          console.log(`✅ PASSED: Response contains expected result "4"`);
          resolve(true);
        } else {
          console.error(`❌ FAILED: Response does not contain expected result "4"`);
          resolve(false);
        }
      } catch (error) {
        console.error(`❌ FAILED: Error processing response: ${error.message}`);
        resolve(false);
      }
    });
    
    // Handle server errors
    server.on('error', (error) => {
      console.error(`❌ FAILED: Server error: ${error.message}`);
      resolve(false);
    });
  });
}

// Run the test
testSimpleAddition().then(passed => {
  console.log(`Test ${passed ? 'PASSED' : 'FAILED'}`);
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
}); 