#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import executeCode from the main server file
import { executeCode } from '../simple-repl-server.js';

async function testExecuteCode() {
  console.log('Testing executeCode function directly...');
  
  // Simple addition test
  const code = 'return 2 + 2';
  console.log(`Executing code: ${code}`);
  
  try {
    const result = await executeCode(code);
    console.log('Execution result:', result);
    
    if (result.success && result.result === 4) {
      console.log('✅ PASSED: Result is 4');
      return true;
    } else {
      console.log('❌ FAILED: Result is not 4');
      console.log('Result:', result);
      return false;
    }
  } catch (error) {
    console.error('Error executing code:', error);
    return false;
  }
}

// Run the test
testExecuteCode().then(passed => {
  console.log(`\n--- Test Summary ---`);
  console.log(`Direct executeCode test ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`-------------------`);
  process.exit(passed ? 0 : 1);
}).catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
}); 