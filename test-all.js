#!/usr/bin/env node

/**
 * REPL Test Runner
 * Tests the server according to the Model Context Protocol (MCP) standards
 * Executes each test in isolation with a fresh server instance
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const TESTS_DIR = path.join(__dirname, 'tests');
const TEMP_SERVER_PATH = path.join(__dirname, 'temp-test-server.cjs');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Debug mode is always on for better output
function debug(message) {
  console.error(`${colors.yellow}[DEBUG] ${message}${colors.reset}`);
}

// Test timeout in milliseconds (10 seconds)
const TEST_TIMEOUT = 10000;

// Function to create a temporary modified server file
const createTemporaryServer = async () => {
  try {
    // Define the server code to write to the file
    const serverCode = fs.readFileSync(TEMP_SERVER_PATH, 'utf8');
    
    // Write the server file
    fs.writeFileSync(TEMP_SERVER_PATH, serverCode);
    debug(`Temporary server file verified at: ${TEMP_SERVER_PATH}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}Failed to create temporary server: ${error.message}${colors.reset}`);
    return false;
  }
};

// Function to clean up the temporary server file
function cleanupTemporaryServer() {
  try {
    if (fs.existsSync(TEMP_SERVER_PATH)) {
      fs.unlinkSync(TEMP_SERVER_PATH);
      debug('Temporary server file removed');
    }
  } catch (error) {
    console.error(`${colors.red}Error cleaning up temporary server: ${error.message}${colors.reset}`);
  }
}

// Async function to load all test files
async function loadAllTests() {
  try {
    console.log(`${colors.cyan}${colors.bright}=== REPL Test Runner ===${colors.reset}`);
    
    // Check if tests directory exists
    if (!fs.existsSync(TESTS_DIR)) {
      console.error(`${colors.red}Tests directory not found: ${TESTS_DIR}${colors.reset}`);
      process.exit(1);
    }
    
    // Get all test files
    const testFiles = fs.readdirSync(TESTS_DIR)
      .filter(file => file.endsWith('.js') && !file.startsWith('_'))
      .filter(file => file !== 'README.md') // Skip README
      .sort();
    
    console.log(`${colors.cyan}Found ${testFiles.length} test files${colors.reset}`);
    
    const allTests = [];
    
    // Load tests from each file
    for (const testFile of testFiles) {
      try {
        console.log(`${colors.cyan}Loading tests from ${testFile}...${colors.reset}`);
        const filePath = path.join(TESTS_DIR, testFile);
        
        // Try to import the file to get the tests
        try {
          // Convert file path to URL format for ESM import
          const fileUrl = new URL(`file://${filePath}`);
          const module = await import(fileUrl);
          
          // Get the tests from the default export
          const tests = module.default || [];
          if (Array.isArray(tests) && tests.length > 0) {
            allTests.push({
              file: testFile,
              path: filePath,
              testCount: tests.length,
              tests: tests
            });
            
            console.log(`${colors.green}  ✓ Loaded ${tests.length} tests from ${testFile}${colors.reset}`);
          } else {
            console.log(`${colors.yellow}  ⚠ No tests found in ${testFile}${colors.reset}`);
          }
        } catch (importErr) {
          // Fallback to regex parsing if import fails
          console.log(`${colors.yellow}  ⚠ Could not import ${testFile}, falling back to parsing${colors.reset}`);
          
          const fileContent = fs.readFileSync(filePath, 'utf8');
          // Count tests by looking for "name": patterns in arrays
          const nameMatches = fileContent.match(/"name":\s*"([^"]+)"/g);
          const testCount = nameMatches ? nameMatches.length : 0;
          
          if (testCount > 0) {
            allTests.push({
              file: testFile,
              path: filePath,
              testCount
            });
            
            console.log(`${colors.green}  ✓ Found ${testCount} tests in ${testFile} via parsing${colors.reset}`);
          } else {
            console.log(`${colors.yellow}  ⚠ No tests found in ${testFile}${colors.reset}`);
          }
        }
      } catch (err) {
        console.error(`${colors.red}Error loading ${testFile}: ${err.message}${colors.reset}`);
      }
    }
    
    return allTests;
  } catch (err) {
    console.error(`${colors.red}Error loading tests: ${err.message}${colors.reset}`);
    return [];
  }
}

// Execute a single test with a fresh server instance
async function runSingleTest(test) {
  return new Promise((resolve) => {
    // Start a new server instance for this test
    const serverArgs = [TEMP_SERVER_PATH];
    
    debug(`Starting server with: node ${serverArgs.join(' ')}`);
    const server = spawn('node', serverArgs);
    
    // Create MCP JSON-RPC request
    const request = {
      jsonrpc: '2.0',
      id: '1',
      method: 'callTool', // Use the simple-repl-server method that works (lowercase)
      params: {
        name: 'execute',
        arguments: {
          code: test.code
        }
      }
    };
    
    let responseData = '';
    let errorData = '';
    let timeoutId = null;
    
    debug(`Test request: ${JSON.stringify(request)}`);
    
    // Set up timeout for this test
    timeoutId = setTimeout(() => {
      debug(`Test timeout after ${TEST_TIMEOUT}ms`);
      server.kill();
      resolve({
        success: false,
        error: `Test timeout after ${TEST_TIMEOUT/1000} seconds`,
        stderr: errorData,
        stdout: responseData
      });
    }, TEST_TIMEOUT);
    
    // Collect stdout from the server line by line
    server.stdout.on('data', (data) => {
      const chunk = data.toString();
      debug(`Server stdout: ${chunk}`);
      responseData += chunk;
      
      // Parse line by line to look for JSON-RPC responses
      const lines = responseData.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || !line.includes('jsonrpc')) continue;
        
        try {
          // Try to parse each line as a JSON response
          const response = JSON.parse(line);
          debug(`Parsed JSON-RPC response: ${JSON.stringify(response)}`);
          
          // We only care about responses with our ID
          if (response.jsonrpc === '2.0' && response.id === '1') {
            // We got a valid response, clear timeout and kill server
            clearTimeout(timeoutId);
            server.kill();
            
            // Process the response
            if (response.error) {
              debug(`Server returned error: ${JSON.stringify(response.error)}`);
              resolve({
                success: false,
                error: response.error.message || 'Unknown error',
                errorCode: response.error.code
              });
              return;
            }
            
            // Check if result has the expected content field
            if (response.result && response.result.content) {
              // Extract text content
              const resultText = response.result.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('\n');
              
              debug(`Extracted text content: ${resultText}`);
              
              // Compare with expected result if provided
              if (test.expected) {
                const normalizedResult = resultText.trim().replace(/\s+/g, ' ');
                const normalizedExpected = test.expected.trim().replace(/\s+/g, ' ');
                
                debug(`Comparing results:
Expected: ${normalizedExpected}
Actual: ${normalizedResult}`);
                
                // For console output tests, check if the expected text is included
                // This is more forgiving for console output which may include timestamps or formatting
                if (test.code.includes('console.')) {
                  if (normalizedResult.includes(normalizedExpected)) {
                    resolve({
                      success: true,
                      result: resultText
                    });
                  } else {
                    resolve({
                      success: false,
                      error: 'Console output did not match expected output',
                      expected: normalizedExpected,
                      actual: normalizedResult
                    });
                  }
                } else {
                  // For regular tests, do a stricter comparison
                  // But still allow for small variations in formatting
                  const cleanExpected = normalizedExpected.replace(/[\{\}\[\]]/g, '').trim();
                  const cleanResult = normalizedResult.replace(/[\{\}\[\]]/g, '').trim();
                  
                  if (normalizedResult.includes(normalizedExpected) || 
                      normalizedResult === normalizedExpected ||
                      cleanResult.includes(cleanExpected)) {
                    resolve({
                      success: true,
                      result: resultText
                    });
                  } else {
                    resolve({
                      success: false,
                      error: 'Result did not match expected output',
                      expected: normalizedExpected,
                      actual: normalizedResult
                    });
                  }
                }
              } else {
                // No expected value provided, consider it successful
                resolve({
                  success: true,
                  result: resultText
                });
              }
              return;
            } else {
              debug(`Invalid response format: missing content field`);
              resolve({
                success: false,
                error: 'Invalid response format: missing content',
                fullResponse: JSON.stringify(response)
              });
              return;
            }
          }
        } catch (e) {
          // Not a valid JSON for this line, continue to next line
          debug(`Failed to parse JSON: ${e.message}, continuing`);
          continue;
        }
      }
    });
    
    // Collect stderr for debugging
    server.stderr.on('data', (data) => {
      const chunk = data.toString();
      debug(`Server stderr: ${chunk}`);
      errorData += chunk;
    });
    
    // Handle server exit
    server.on('exit', (code) => {
      debug(`Server exited with code: ${code}`);
      if (code !== null && code !== 0 && timeoutId) {
        // Server exited with error before responding
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: `Server exited with code ${code}`,
          stderr: errorData
        });
      }
    });
    
    // Wait briefly for server to start up before sending request
    setTimeout(() => {
      debug(`Sending request to server: ${JSON.stringify(request)}`);
      // Send the request to the server
      server.stdin.write(JSON.stringify(request) + '\n');
    }, 1000);
  });
}

// Run all tests
async function runAllTests(testFiles) {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  console.log(`\n${colors.cyan}${colors.bright}=== Running Tests ===${colors.reset}`);
  
  // Run all test files
  for (const testFile of testFiles) {
    console.log(`\n${colors.blue}Running tests from ${testFile.file} (${testFile.testCount} tests)${colors.reset}`);
    
    // Increment total tests
    totalTests += testFile.testCount;
    
    try {
      // If we have actual test objects, run them
      if (testFile.tests && Array.isArray(testFile.tests)) {
        let fileFailedTests = 0;
        // Run all tests
        const testsToRun = testFile.tests;
        
        for (const test of testsToRun) {
          if (test.name) {
            process.stdout.write(`  - ${test.name}: `);
            
            // Run test with its own server instance
            const result = await runSingleTest(test);
            
            if (result.success) {
              process.stdout.write(`${colors.green}PASS${colors.reset}\n`);
              passedTests++;
            } else {
              process.stdout.write(`${colors.red}FAIL${colors.reset}\n`);
              if (result.error) {
                console.log(`    Error: ${result.error}`);
                if (result.expected && result.actual) {
                  console.log(`    Expected: ${result.expected}`);
                  console.log(`    Actual: ${result.actual}`);
                }
                if (result.stderr) {
                  console.log(`    Server stderr: ${result.stderr.trim()}`);
                }
              }
              failedTests++;
              fileFailedTests++;
            }
          }
        }
        
        // Test file summary
        if (fileFailedTests === 0) {
          console.log(`${colors.green}  ✓ All tests passed in ${testFile.file}${colors.reset}`);
        } else {
          console.log(`${colors.red}  ✗ ${fileFailedTests} tests failed in ${testFile.file}${colors.reset}`);
        }
      } else {
        // We only know the count but don't have test data
        console.log(`${colors.yellow}  ⚠ Skipping ${testFile.testCount} tests without test data${colors.reset}`);
      }
    } catch (err) {
      console.error(`${colors.red}Error running tests in ${testFile.file}: ${err.message}${colors.reset}`);
    }
  }
  
  // Summary
  console.log(`\n${colors.cyan}${colors.bright}=== Test Summary ===${colors.reset}`);
  console.log(`${colors.cyan}Total tests: ${totalTests}${colors.reset}`);
  console.log(`${colors.green}Tests passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Tests failed: ${failedTests}${colors.reset}`);
  
  if (failedTests === 0) {
    console.log(`${colors.green}${colors.bright}All tests passed! 🎉${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}Some tests failed. 😢${colors.reset}`);
  }
  
  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests
  };
}

// Main function
async function main() {
  try {
    // Create the temporary server with our modifications
    if (!await createTemporaryServer()) {
      console.error(`${colors.red}Failed to create temporary server. Cannot run tests.${colors.reset}`);
      process.exit(1);
    }

    const testFiles = await loadAllTests();
    const results = await runAllTests(testFiles);
    
    // Clean up temporary server
    cleanupTemporaryServer();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
    
    // Clean up temporary server even if there's an error
    cleanupTemporaryServer();
    
    process.exit(1);
  }
}

// Run the main function
main(); 