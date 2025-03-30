#!/usr/bin/env node

/**
 * Simplified test for the REPL execution environment 
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Basic test script
const TEST_SCRIPT = `
// Basic test of REPL environment
console.log('REPL test running...');

// Test object
const obj = { 
  string: 'test string',
  number: 123,
  boolean: true,
  array: [1, 2, 3]
};

// Test console methods
console.log('Log message');
console.error('Error message');

// Output object
console.log('Test object:', obj);

// Return value
obj;
`;

// Create and execute test file
async function runTest() {
  console.log('Running basic REPL environment test...');
  
  // Create a temp file
  const tempFile = path.join(tempDir, `test-${Date.now()}.js`);
  fs.writeFileSync(tempFile, TEST_SCRIPT);
  
  try {
    // Execute with Node
    const child = spawn('node', [tempFile], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Test completed successfully');
          resolve();
        } else {
          console.error(`❌ Test failed with code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      
      child.on('error', (err) => {
        console.error(`❌ Error executing test: ${err.message}`);
        reject(err);
      });
    });
    
    return { success: true };
  } catch (error) {
    console.error('Test execution failed:', error.message);
    return { success: false, error };
  } finally {
    // Clean up
    try {
      fs.unlinkSync(tempFile);
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

// Run test
runTest().then(result => {
  process.exit(result.success ? 0 : 1);
}); 