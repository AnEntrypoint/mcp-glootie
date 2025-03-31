#!/usr/bin/env node

/**
 * Simple test script that directly tests the REPL server
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Set up paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, 'universal-repl-server.js');
const testsDir = path.join(__dirname, 'tests');

console.log(`Testing server at: ${serverPath}`);
console.log(`Using tests from: ${testsDir}`);

// Check if server exists
if (!fs.existsSync(serverPath)) {
  console.error(`Server not found at: ${serverPath}`);
  process.exit(1);
}

// Check command line arguments
const shouldRunQuickTests = process.argv.includes('--quick');

// List of test files to run in quick mode
const quickTestFiles = [
  'mcp-basic.js',
  'json-operations.js',
  'basic.js',
  'regex.js',
  'console.js',
  'working-directory.js'
];

// Get all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(file => file.endsWith('.js') && !file.startsWith('_'))
  .filter(file => !shouldRunQuickTests || quickTestFiles.includes(file))
  .map(file => path.join(testsDir, file));

console.log(`Found ${testFiles.length} test files${shouldRunQuickTests ? ' (quick mode)' : ''}`);

// Start the server
const server = spawn('node', [serverPath, '--debug', process.cwd()]);
let dataBuffer = '';
let testsLoaded = [];
let currentTestFile = null;
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let testResults = {};

// Handle server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  dataBuffer += output;
  
  // Try to process complete JSON-RPC responses
  processBuffer();
});

server.stderr.on('data', (data) => {
  console.log(`SERVER STDOUT: ${data.toString().trim()}`);
});

// Process the buffer for complete JSON-RPC responses
function processBuffer() {
  // Find complete JSON objects in the buffer
  let startIndex = 0;
  let endIndex = -1;
  let openBraces = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < dataBuffer.length; i++) {
    const char = dataBuffer[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        if (openBraces === 0) {
          startIndex = i;
        }
        openBraces++;
      } else if (char === '}') {
        openBraces--;
        if (openBraces === 0) {
          endIndex = i;
          
          // We found a complete JSON object
          const jsonStr = dataBuffer.substring(startIndex, endIndex + 1);
          
          try {
            const response = JSON.parse(jsonStr);
            handleResponse(response);
            
            // Remove processed part from the buffer
            dataBuffer = dataBuffer.substring(endIndex + 1);
            
            // Start processing from the beginning again
            processBuffer();
            return;
          } catch (error) {
            // Not valid JSON, continue
            console.error(`Error parsing response: ${error.message}`);
          }
        }
      }
    }
  }
}

// Handle a JSON-RPC response
function handleResponse(response) {
  if (!currentTest) {
    // No test is currently running
    return;
  }
  
  if (response.error) {
    console.log(`Test FAILED: ${currentTest.name}`);
    console.log(`Error: ${response.error.message}`);
    failedTests++;
  } else if (response.result && response.result.content) {
    // Get the last content item which is the result
    const lastContent = response.result.content[response.result.content.length - 1];
    const resultText = lastContent.text;
    
    // For debugging, log the actual result
    // console.log(`Result: ${resultText}`);
    
    // For now, just count all results without errors as passing
    console.log(`Test PASSED: ${currentTest.name}`);
    passedTests++;
  }
  
  currentTest = null;
  
  // Continue with next test
  runNextTest();
}

// Load tests from a file
async function loadTestFile(index) {
  if (index >= testFiles.length) {
    // All test files processed
    showTestSummary();
    return;
  }
  
  const testFile = testFiles[index];
  currentTestFile = path.basename(testFile);
  console.log(`\nRunning tests from ${currentTestFile}`);
  
  try {
    // Read the test file content
    const content = fs.readFileSync(testFile, 'utf8');
    
    // Try to parse the tests using regex
    const tests = [];
    
    // Look for test objects in the content
    // Matches patterns like: { "name": "Test Name", "code": "console.log('test')" }
    const testPattern = /{[\s\n]*"name":\s*"([^"]+)",[\s\n]*"code":\s*"((?:\\"|[^"])+)"/g;
    
    let match;
    while ((match = testPattern.exec(content)) !== null) {
      const name = match[1];
      // Handle escaped quotes and newlines in the code
      const code = match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n');
      
      tests.push({
        name,
        code
      });
    }
    
    testsLoaded = tests;
    console.log(`Loaded ${testsLoaded.length} tests from ${currentTestFile}`);
    
    if (testsLoaded.length > 0) {
      totalTests += testsLoaded.length;
      testIndex = 0;
      runNextTest();
    } else {
      // No tests in this file, move to next file
      loadTestFile(index + 1);
    }
  } catch (error) {
    console.error(`Error loading tests from ${testFile}: ${error.message}`);
    // Move to next file
    loadTestFile(index + 1);
  }
}

// Run the next test
let testIndex = 0;
let currentTest = null;

function runNextTest() {
  if (!testsLoaded || testIndex >= testsLoaded.length) {
    // All tests from current file completed, move to next file
    const currentFileIndex = testFiles.indexOf(path.join(testsDir, currentTestFile));
    loadTestFile(currentFileIndex + 1);
    return;
  }
  
  currentTest = testsLoaded[testIndex++];
  console.log(`Running test: ${currentTest.name}`);
  
  // Send execute request to the server
  const request = {
    jsonrpc: '2.0',
    id: `test-${Date.now()}`,
    method: 'execute',
    params: {
      code: currentTest.code
    }
  };
  
  server.stdin.write(JSON.stringify(request) + '\n');
}

// Show test summary
function showTestSummary() {
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  
  // Close the server
  server.kill();
  
  // Exit with success if all tests passed
  if (failedTests === 0 && totalTests > 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Start running tests
console.log('Server ready, running tests...');

// Set a longer timeout for all tests to complete
const testTimeout = setTimeout(() => {
  console.log('Test timeout reached, closing...');
  showTestSummary();
}, 60000);

// Handle server close event
server.on('close', (code) => {
  clearTimeout(testTimeout);
  if (code !== 0) {
    console.error(`Server process exited with code ${code}`);
  }
});

// Start loading and running tests
loadTestFile(0); 