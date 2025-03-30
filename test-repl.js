#!/usr/bin/env node

/**
 * Test script for the REPL server
 * This file runs a series of tests against the REPL server
 */

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import util from 'util';

// Convert execFile to Promise-based
const execFileAsync = util.promisify(execFile);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test directory
const TEST_DIR = path.join(__dirname, 'test');
const TEMP_DIR = path.join(__dirname, 'temp');

// Create test directory if it doesn't exist
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Basic test cases
const BASIC_TESTS = [
  {
    name: 'Basic object test',
    code: `
      const obj = { test: 'value', number: 123 };
      console.log('Object:', obj);
      obj;
    `,
    validate: (result) => {
      return result.success && 
             result.result && 
             result.result.test === 'value' && 
             result.result.number === 123;
    }
  },
  {
    name: 'Basic console test',
    code: `
      console.log('Test message');
      console.error('Error message');
      'Console test complete';
    `,
    validate: (result) => {
      return result.success && 
             result.logs && 
             result.logs.some(log => log[0] === 'log' && log[1].includes('Test message')) &&
             result.logs.some(log => log[0] === 'error' && log[1].includes('Error message'));
    }
  },
  {
    name: 'Process object test',
    code: `
      console.log('Platform:', process.platform);
      console.log('Version:', process.version);
      { platform: process.platform, version: process.version };
    `,
    validate: (result) => {
      return result.success && 
             result.result && 
             typeof result.result.platform === 'string' &&
             typeof result.result.version === 'string';
    }
  },
  {
    name: 'Async/await test',
    code: `
      const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      await wait(100);
      'Async test complete';
    `,
    validate: (result) => {
      return result.success && result.result === 'Async test complete';
    }
  }
];

// Run a single test
async function runTest(test) {
  console.log(`Running test: ${test.name}`);
  
  // Create a temp file for the test
  const tempFile = path.join(TEMP_DIR, `test-${Date.now()}.js`);
  
  // Create test content - this is a simplified version of what the REPL server does
  const testContent = `
    // Test: ${test.name}
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;

    console.log = function(...args) {
      const formatted = args.join(' ');
      logs.push(['log', formatted]);
      originalLog(...args);
    };

    console.error = function(...args) {
      const formatted = args.join(' ');
      logs.push(['error', formatted]);
      originalError(...args);
    };

    // Safe process object
    global.process = {
      platform: '${process.platform}',
      version: '${process.version}',
      cwd: () => '${process.cwd().replace(/\\/g, '\\\\')}',
      env: {},
      nextTick: (cb) => setTimeout(cb, 0)
    };

    // Execute test
    (async () => {
      let result;
      let success = true;
      let error = null;
      
      try {
        // Execute the test code
        result = await (async () => {
          ${test.code}
        })();
      } catch (err) {
        success = false;
        error = {
          message: err.message,
          stack: err.stack
        };
        console.error('Error:', err.message);
      }
      
      // Output result for parsing
      console.log(JSON.stringify({
        testName: '${test.name}',
        success,
        logs,
        result,
        error
      }));
    })();
  `;
  
  // Write the test file
  fs.writeFileSync(tempFile, testContent);
  
  try {
    // Execute the test
    const result = await execFileAsync('node', [tempFile]);
    
    // Parse the output to find the JSON result
    const jsonMatch = result.stdout.match(/\{[\s\S]*"testName"[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to find JSON result in output');
      console.error('Output:', result.stdout);
      return { success: false, name: test.name };
    }
    
    const testResult = JSON.parse(jsonMatch[0]);
    
    // Validate the result
    const isValid = test.validate(testResult);
    
    if (isValid) {
      console.log(`✅ PASSED: "${test.name}"`);
      return { success: true, name: test.name };
    } else {
      console.log(`❌ FAILED: "${test.name}"`);
      console.log('Result:', JSON.stringify(testResult, null, 2));
      return { success: false, name: test.name };
    }
  } catch (error) {
    console.error(`❌ ERROR: "${test.name}"`);
    console.error('Error:', error.message);
    return { success: false, name: test.name, error };
  } finally {
    // Clean up the temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run all tests
async function runAllTests() {
  console.log('=== REPL Server Test Suite ===');
  
  const results = [];
  
  for (const test of BASIC_TESTS) {
    const result = await runTest(test);
    results.push(result);
  }
  
  // Print summary
  console.log('\n=== Test Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('====================\n');
  
  // Return non-zero exit code if any tests failed
  return results.every(r => r.success) ? 0 : 1;
}

// Run the tests
runAllTests().then(exitCode => {
  process.exit(exitCode);
});
