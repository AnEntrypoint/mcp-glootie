#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTest } from './tests/test-framework.js';

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
        allTests.push(...testCases);
      }
    } catch (error) {
      console.error(`Error loading test file ${file}:`, error);
    }
  }
  
  return allTests;
}

/**
 * Run all test cases
 */
async function runAllTests() {
  console.log('Starting REPL server tests...');
  
  // Load all test cases dynamically
  const testCases = await loadTestCases();
  console.log(`Total test cases loaded: ${testCases.length}`);
  
  // Actually run the tests
  let passed = 0;
  let failed = 0;
  
  // Process tests in sequence to avoid overwhelming the system
  for (const testCase of testCases) {
    const testPassed = await runTest(testCase);
    if (testPassed) {
      passed++;
      console.log(`✅ PASSED: "${testCase.name}"`);
    } else {
      failed++;
    }
  }
  
  console.log('\n\n--- Test Summary ---');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('-------------------');
  
  // Return non-zero exit code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
