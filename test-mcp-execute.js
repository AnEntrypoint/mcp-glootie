#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { executeCode, formatMCPResponse } from './mcp-wrapper.js';

/**
 * Simple CLI tool to test MCP execute functionality
 * This provides a direct way to test JavaScript code execution
 * without going through the full MCP protocol
 */

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'MCP-Execute> '
});

// Process arguments
const args = process.argv.slice(2);
let initialCode = '';

if (args.length > 0) {
  // Check if it's a file path
  const arg = args[0];
  if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
    initialCode = fs.readFileSync(arg, 'utf-8');
    console.log(`Loaded code from file: ${arg}`);
    executeAndPrint(initialCode);
  } else {
    // Use argument as direct code
    initialCode = arg;
    executeAndPrint(initialCode);
  }
}

// Helper function to execute code and print results
async function executeAndPrint(code) {
  console.log('\nExecuting code:\n-------------------');
  console.log(code);
  console.log('-------------------');
  
  try {
    const result = await executeCode(code, { timeout: 15000 });
    const response = formatMCPResponse(result);
    
    console.log('\nExecution Results:\n-------------------');
    
    if (response.content && response.content.length > 0) {
      response.content.forEach(item => {
        console.log(item.text);
      });
    } else {
      console.log('No output');
    }
    
    console.log('-------------------\n');
  } catch (error) {
    console.error('Execution error:', error.message);
  }
  
  rl.prompt();
}

// Main interactive loop
rl.prompt();

rl.on('line', async (line) => {
  const input = line.trim();
  
  if (input === 'exit' || input === 'quit') {
    rl.close();
    return;
  }
  
  if (input === 'help') {
    console.log(`
Available commands:
  help         - Show this help message
  exit, quit   - Exit the tool
  run <file>   - Execute code from a file
  test         - Run the default keystore test
  
Any other input will be executed as JavaScript code.
    `);
    rl.prompt();
    return;
  }
  
  if (input.startsWith('run ')) {
    const filePath = input.substring(4).trim();
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const code = fs.readFileSync(filePath, 'utf-8');
        await executeAndPrint(code);
      } else {
        console.error(`File not found: ${filePath}`);
        rl.prompt();
      }
    } catch (error) {
      console.error(`Error reading file: ${error.message}`);
      rl.prompt();
    }
    return;
  }
  
  if (input === 'test') {
    // Run the keystore test with mock data
    const keystoreTest = `
    // Test the wrappedkeystore service using fetch
    async function testKeystore() {
      const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nxmqazntnbzpkhmzwmue.supabase.co';
      
      // Create test keys with unique timestamps
      const timestamp = Date.now();
      const testKey = \`repl-test-\${timestamp}\`;
      const testValue = {
        message: 'Test from MCP REPL',
        timestamp,
        nested: {
          value: 42,
          flag: true
        }
      };
      
      console.log(\`Testing keystore with key: \${testKey}\`);
      console.log(\`Test value: \${JSON.stringify(testValue, null, 2)}\`);
      
      try {
        // Simulate mock responses for testing
        const mockData = {
          set: { 
            data: { success: true, key: testKey },
            status: 200
          },
          get: { 
            data: { success: true, value: testValue },
            status: 200
          },
          delete: { 
            data: { success: true, deleted: true },
            status: 200
          },
          verify: { 
            data: { success: false, message: "Key not found" },
            status: 404
          }
        };
        
        // 1. Set key - simulated
        console.log('\\n1. Setting key...');
        const setResponse = {
          status: mockData.set.status,
          json: async () => mockData.set
        };
        
        const setResult = await setResponse.json();
        console.log(\`Set key result (\${setResponse.status}):\`);
        console.log(JSON.stringify(setResult, null, 2));
        
        // 2. Get key - simulated
        console.log('\\n2. Getting key...');
        const getResponse = {
          status: mockData.get.status,
          json: async () => mockData.get
        };
        
        const getResult = await getResponse.json();
        console.log(\`Get key result (\${getResponse.status}):\`);
        console.log(JSON.stringify(getResult, null, 2));
        
        // 3. Verify values match
        console.log('\\n3. Verifying values...');
        if (getResult && getResult.data && getResult.data.success) {
          const retrievedValue = getResult.data.value;
          const valuesMatch = JSON.stringify(retrievedValue) === JSON.stringify(testValue);
          console.log(\`Value verification: \${valuesMatch ? 'SUCCESS' : 'FAILED'}\`);
          
          if (!valuesMatch) {
            console.log('Original:', JSON.stringify(testValue));
            console.log('Retrieved:', JSON.stringify(retrievedValue));
          }
        } else {
          console.log('Value verification: FAILED - Unable to retrieve value');
        }
        
        // 4. Delete key - simulated
        console.log('\\n4. Deleting key...');
        const deleteResponse = {
          status: mockData.delete.status,
          json: async () => mockData.delete
        };
        
        const deleteResult = await deleteResponse.json();
        console.log(\`Delete key result (\${deleteResponse.status}):\`);
        console.log(JSON.stringify(deleteResult, null, 2));
        
        // 5. Verify deletion - simulated
        console.log('\\n5. Verifying deletion...');
        const verifyResponse = {
          status: mockData.verify.status,
          json: async () => mockData.verify
        };
        
        const verifyResult = await verifyResponse.json();
        console.log(\`Verify deletion result (\${verifyResponse.status}):\`);
        console.log(JSON.stringify(verifyResult, null, 2));
        
        // Return overall test result
        return {
          success: getResult?.data?.success && 
                   JSON.stringify(getResult?.data?.value) === JSON.stringify(testValue),
          setResult,
          getResult,
          deleteResult,
          verifyResult
        };
        
      } catch (error) {
        console.error('Error testing keystore:', error);
        return {
          success: false,
          error: error.message
        };
      }
    }
    
    // Create an immediately invoked async function to ensure returned values are captured
    (async () => {
      try {
        console.log('Starting keystore test...');
        const result = await testKeystore();
        console.log('\\n========== FINAL RESULT ==========');
        console.log(\`Test successful: \${result.success}\`);
        console.log('Complete result:', JSON.stringify(result, null, 2));
        
        return result;
      } catch (error) {
        console.error('Error in main execution:', error);
        return { success: false, error: error.message };
      }
    })();
    `;
    
    await executeAndPrint(keystoreTest);
    return;
  }
  
  // Execute input as JavaScript code
  await executeAndPrint(input);
});

rl.on('close', () => {
  console.log('MCP Execute test tool exiting...');
  process.exit(0);
}); 