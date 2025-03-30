#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runTest } from '../tests/test-framework.js';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run a single test file
 * @param {string} testFile - The test file to run
 */
async function runSingleTest(testFile) {
  console.log(`Running test file: ${testFile}`);
  
  try {
    const modulePath = `../tests/${testFile}`;
    const module = await import(modulePath);
    const testCases = module.default;
    
    if (!Array.isArray(testCases)) {
      console.error(`Test file ${testFile} does not export a valid array of test cases`);
      process.exit(1);
    }
    
    console.log(`Loaded ${testCases.length} tests from ${testFile}`);
    
    // Just run the first test case for debugging
    const testCase = testCases[0];
    console.log(`Running test: "${testCase.name}"`);
    console.log(`Code: ${testCase.code}`);
    
    const testPassed = await runTest(testCase);
    
    console.log(`\n--- Test Summary ---`);
    console.log(`Test: ${testCase.name}`);
    console.log(`Passed: ${testPassed ? 'YES' : 'NO'}`);
    console.log(`-------------------`);
    
    process.exit(testPassed ? 0 : 1);
  } catch (error) {
    console.error(`Error running test file ${testFile}:`, error);
    process.exit(1);
  }
}

// Get the test file from the command line
const testFile = process.argv[2];
if (!testFile) {
  console.error('Please specify a test file to run, e.g., basic.js');
  process.exit(1);
}

// Run the single test
runSingleTest(testFile).catch(error => {
  console.error('Error running test:', error);
  process.exit(1);
}); 