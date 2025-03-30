#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeCode } from './simple-repl-server.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dynamically load all test files from the tests directory
 * @returns {Array} Array of test cases
 */
async function loadTestCases() {
  const testsDir = path.join(__dirname, 'tests');
  const testFiles = fs.readdirSync(testsDir)
    .filter(file => 
      file.endsWith('.js') && 
      file !== 'test-framework.js' && 
      !file.startsWith('.')
    );
  
  console.log(`Found ${testFiles.length} test files:`);
  testFiles.forEach(file => console.log(`- ${file}`));
  console.log('');
  
  const allTests = [];
  
  // Import each test file and load the test cases
  for (const file of testFiles) {
    try {
      const modulePath = `./tests/${file}`;
      const module = await import(modulePath);
      const testCases = module.default;
      
      if (Array.isArray(testCases)) {
        console.log(`Loaded ${testCases.length} tests from ${file}`);
        allTests.push(...testCases.map(test => ({ ...test, file })));
      }
    } catch (error) {
      console.error(`Error loading test file ${file}:`, error);
    }
  }
  
  return allTests;
}

/**
 * Run all test cases directly with executeCode
 */
async function runAllTests() {
  console.log('Starting REPL server tests...');
  
  // Load all test cases dynamically
  const testCases = await loadTestCases();
  console.log(`Total test cases loaded: ${testCases.length}`);
  
  // Track results
  let passed = 0;
  let failed = 0;
  const failedTests = [];
  
  // Process tests in sequence
  for (const testCase of testCases) {
    const { name, code, expected, file } = testCase;
    console.log(`Testing: ${name} (${file})`);
    
    try {
      // Run the code with executeCode
      const result = await executeCode(code);
      
      // Check if the test passed
      let testPassed = false;
      
      if (result.success) {
        // For successful executions, check the result against expected value
        if (expected === undefined) {
          // If no expected value provided, assume success is enough
          testPassed = true;
        } else if (typeof expected === 'string') {
          // For string expectations, check if the result includes the string
          const resultStr = typeof result.result === 'string' 
            ? result.result 
            : JSON.stringify(result.result);
          testPassed = resultStr.includes(expected);
        } else {
          // For other types, try to compare directly
          testPassed = JSON.stringify(result.result) === JSON.stringify(expected);
        }
        
        // Special case for console output tests
        if (!testPassed && result.logs && result.logs.length > 0) {
          // Check if any of the logs contain the expected output
          testPassed = result.logs.some(log => 
            typeof expected === 'string' && log.includes(expected)
          );
        }
      } else {
        // For error tests, check if the failure is expected
        if (name.toLowerCase().includes('error') || 
            name.includes('restricted') || 
            name.includes('security')) {
          testPassed = true;
        }
      }
      
      // Record the result
      if (testPassed) {
        console.log(`✅ PASSED: "${name}"`);
        passed++;
      } else {
        console.log(`❌ FAILED: "${name}"`);
        console.log(`   Expected: ${JSON.stringify(expected)}`);
        console.log(`   Actual: ${result.success ? JSON.stringify(result.result) : result.error}`);
        
        if (result.logs && result.logs.length > 0) {
          console.log(`   Logs: ${result.logs.join('\n   ')}`);
        }
        
        failed++;
        failedTests.push({ name, file });
      }
    } catch (error) {
      console.error(`Error running test "${name}":`, error);
      failed++;
      failedTests.push({ name, file });
    }
  }
  
  console.log('\n\n--- Test Summary ---');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    failedTests.forEach(({ name, file }) => {
      console.log(`- ${name} (${file})`);
    });
  }
  
  console.log('-------------------');
  
  // Return exit code based on test results
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
