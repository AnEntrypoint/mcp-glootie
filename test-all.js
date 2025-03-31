#!/usr/bin/env node

/**
 * MCP Test Runner
 * Tests the server according to the Model Context Protocol (MCP) standards
 * Uses direct JSON-RPC over stdin/stdout to communicate with the server
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import chalk from 'chalk';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const TESTS_DIR = path.join(__dirname, 'tests');
const SERVER_PATH = path.join(__dirname, 'universal-repl-server.js');

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

// Check for quick mode
const QUICK_MODE = process.argv.includes('--quick');
const MAX_FILES_IN_QUICK_MODE = 5;
const MAX_PASSES_IN_QUICK_MODE = 5;
const MAX_FAILURES_IN_QUICK_MODE = 5;

// Debug mode flag
const DEBUG = process.argv.includes('--debug');

// Debug logging function
function debug(message) {
  if (DEBUG) {
    console.error(`${colors.yellow}[DEBUG] ${message}${colors.reset}`);
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
    
    // Check if server file exists
    if (!fs.existsSync(SERVER_PATH)) {
      console.error(`${colors.red}REPL server not found: ${SERVER_PATH}${colors.reset}`);
      process.exit(1);
    }
    
    // Get all test files
    const testFiles = fs.readdirSync(TESTS_DIR)
      .filter(file => file.endsWith('.js') && !file.startsWith('_'))
      .filter(file => file !== 'README.md') // Skip README
      .sort();
    
    console.log(`${colors.cyan}Found ${testFiles.length} test files${colors.reset}`);
    
    const allTests = [];
    
    // Load a limited number of files in quick mode
    const filesToProcess = QUICK_MODE 
      ? testFiles.slice(0, MAX_FILES_IN_QUICK_MODE) 
      : testFiles;
    
    if (QUICK_MODE) {
      console.log(`${colors.yellow}Quick mode enabled - processing ${filesToProcess.length} test files${colors.reset}`);
    }
    
    // Load tests from each file
    for (const testFile of filesToProcess) {
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

/**
 * Start a server instance and create a client connection
 * @returns {Object} - Server process and methods to interact with it
 */
async function createMCPClient() {
  return new Promise((resolve, reject) => {
    try {
      // Start server with debug mode
      const serverArgs = [SERVER_PATH, '--debug', process.cwd()];
      debug(`Starting server: node ${serverArgs.join(' ')}`);
      
      const server = spawn('node', serverArgs);
      
      let serverReady = false;
      let nextId = 1;
      const pendingRequests = new Map();
      
      // Process stdout from server
      server.stdout.on('data', (data) => {
        const chunk = data.toString();
        debug(`Server stdout: ${chunk.trim()}`);
        
        // Process JSON-RPC responses
        try {
          if (chunk.includes('jsonrpc')) {
            const jsonStart = chunk.indexOf('{');
            const jsonEnd = chunk.lastIndexOf('}') + 1;
            
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = chunk.substring(jsonStart, jsonEnd);
              const response = JSON.parse(jsonStr);
              
              if (response.jsonrpc === '2.0' && response.id) {
                const resolver = pendingRequests.get(response.id);
                if (resolver) {
                  resolver.resolve(response);
                  pendingRequests.delete(response.id);
                } else {
                  debug(`No pending request found for response ID: ${response.id}`);
                }
              }
            }
          }
        } catch (e) {
          debug(`Error processing server stdout: ${e.message}`);
        }
      });
      
      // Process stderr from server
      server.stderr.on('data', (data) => {
        const chunk = data.toString();
        debug(`Server stderr: ${chunk.trim()}`);
        
        // Mark server as ready when it outputs the ready message
        if (chunk.includes('REPL server started')) {
          serverReady = true;
          debug('Server is ready to accept requests');
        }
      });
      
      // Handle server exit
      server.on('exit', (code) => {
        debug(`Server exited with code: ${code}`);
        
        // Reject all pending requests
        for (const [id, resolver] of pendingRequests.entries()) {
          resolver.reject(new Error(`Server exited with code ${code}`));
          pendingRequests.delete(id);
        }
      });
      
      // Handle server errors
      server.on('error', (err) => {
        debug(`Server error: ${err.message}`);
        reject(err);
      });
      
      // Wait for server to be ready
      const waitForReady = () => {
        if (serverReady) {
          // Create client interface
          const client = {
            /**
             * Execute code via JSON-RPC
             * @param {string} code - The code to execute
             * @returns {Promise<Object>} - Result of execution
             */
            execute: async (code) => {
              return new Promise((resolve, reject) => {
                const id = String(nextId++);
                
                // Create JSON-RPC request
                const request = {
                  jsonrpc: '2.0',
                  id,
                  method: 'execute',
                  params: {
                    code
                  }
                };
                
                debug(`Sending request: ${JSON.stringify(request, null, 2)}`);
                
                // Store resolver for this request
                pendingRequests.set(id, { resolve, reject });
                
                // Set timeout for request
                const timeout = setTimeout(() => {
                  if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timed out'));
                  }
                }, 5000);
                
                // Send request to server
                server.stdin.write(JSON.stringify(request) + '\n');
              });
            },
            
            /**
             * Close the client and kill the server
             */
            close: () => {
              debug('Closing client and killing server');
              server.kill();
            }
          };
          
          resolve(client);
        } else {
          // Check again after 100ms
          setTimeout(waitForReady, 100);
        }
      };
      
      // Initial check for readiness
      setTimeout(waitForReady, 500);
      
    } catch (err) {
      debug(`Error creating MCP client: ${err.message}`);
      reject(err);
    }
  });
}

/**
 * Function to verify if a test result matches the expected output
 * @param {*} actual - The actual result from the test
 * @param {*} expected - The expected result (can be a string or a function)
 * @returns {boolean} - Whether the test passed
 */
function verifyTestResult(actual, expected) {
  if (typeof expected === 'function') {
    // If expected is a function, call it with the actual result
    return expected(actual);
  }
  
  // Convert both to strings for comparison
  const actualStr = String(actual).trim();
  const expectedStr = String(expected).trim();
  
  // Check different comparison methods
  return actualStr.includes(expectedStr) || 
         expectedStr.includes(actualStr) || 
         actualStr === expectedStr;
}

/**
 * Execute code on the REPL server
 * @param {string} code - The code to execute
 * @returns {Promise<Object>} - Result of execution
 */
async function executeCodeOnServer(code) {
  // Use the global client
  const activeClient = global.client;
  
  if (!activeClient) {
    return { success: false, error: 'No active client' };
  }
  
  try {
    const response = await activeClient.execute(code);
    
    if (response.error) {
      return {
        success: false,
        error: response.error.message || JSON.stringify(response.error)
      };
    }
    
    // Extract result text from content array
    if (response.result && response.result.content) {
      // Get the last text item as the result
      const lastItem = response.result.content[response.result.content.length - 1];
      const resultText = lastItem.text;
      
      return {
        success: true,
        result: resultText,
        content: response.result.content
      };
    }
    
    return { success: true, result: 'No result' };
  } catch (error) {
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}

/**
 * Execute a test on the REPL server
 * @param {Object} test - The test to execute
 * @returns {Promise<boolean>} - Whether the test passed
 */
async function executeTest(test) {
  try {
    // Execute the code and check the result
    const result = await executeCodeOnServer(test.code);
    
    if (!result.success) {
      console.log(chalk.red(`  ✗ ${test.name}`));
      console.log(chalk.red(`    Server error: ${result.error || 'Unknown error'}`));
      return false;
    }
    
    // For console.log tests, check if the expected output appears in any of the content items
    if (test.code.includes('console.log') && result.content && result.content.length > 1) {
      const allOutput = result.content.map(item => item.text).join('\n');
      if (allOutput.includes(test.expected)) {
        console.log(chalk.green(`  ✓ ${test.name}`));
        return true;
      }
    }
    
    const resultText = result.result;
    
    // Function-based expected value handling
    if (typeof test.expected === 'function') {
      const parsedValue = tryParseJSON(resultText);
      const pass = test.expected(parsedValue);
      
      if (pass) {
        console.log(chalk.green(`  ✓ ${test.name}`));
        return true;
      } else {
        console.log(chalk.red(`  ✗ ${test.name}`));
        console.log(chalk.red(`    Error: Result did not pass the expected function check`));
        console.log(chalk.red(`    Actual: ${resultText}`));
        return false;
      }
    }
    
    // String-based comparison (original behavior)
    const normalizedResult = resultText.trim().toLowerCase();
    const normalizedExpected = String(test.expected).trim().toLowerCase();
    
    // Clean up the strings for better comparison
    const cleanExpected = normalizedExpected.replace(/[\{\}\[\]]/g, '').trim();
    const cleanResult = normalizedResult.replace(/[\{\}\[\]]/g, '').trim();
    
    if (normalizedResult.includes(normalizedExpected) || 
        normalizedResult === normalizedExpected ||
        cleanResult.includes(cleanExpected)) {
      console.log(chalk.green(`  ✓ ${test.name}`));
      return true;
    } else {
      console.log(chalk.red(`  ✗ ${test.name}`));
      console.log(chalk.red(`    Error: Result did not match expected output`));
      console.log(chalk.red(`    Expected: ${test.expected}`));
      console.log(chalk.red(`    Actual: ${resultText}`));
      return false;
    }
  } catch (error) {
    console.log(chalk.red(`  ✗ ${test.name}`));
    console.log(chalk.red(`    Error: ${error.message}`));
    return false;
  }
}

/**
 * Helper function to try parsing JSON
 * @param {string} str - The string to parse as JSON
 * @returns {any} - The parsed JSON or the original string if parsing fails
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

/**
 * Run all tests using a fresh client for each test file
 * @param {Array} testFiles - Array of test file objects
 */
async function runAllTests(testFiles) {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  console.log(`\n${colors.cyan}${colors.bright}=== Running Tests ===${colors.reset}`);
  
  // Run tests for each file
  for (const testFile of testFiles) {
    // Create a new client for each test file
    let client;
    try {
      client = await createMCPClient();
      debug(`Created client for ${testFile.file}`);
      
      // Make client available to other functions through this closure
      global.client = client;
    } catch (err) {
      console.error(`${colors.red}Failed to create client for ${testFile.file}: ${err.message}${colors.reset}`);
      continue;
    }
    
    console.log(`\n${colors.blue}Running tests from ${testFile.file} (${testFile.testCount} tests)${colors.reset}`);
    
    // Increment total tests
    totalTests += testFile.testCount;
    
    try {
      // If we have actual test objects, run them
      if (testFile.tests && Array.isArray(testFile.tests)) {
        // Run all tests in this file
        for (const test of testFile.tests) {
          if (test.name) {
            console.log(`  - ${test.name}: `);
            
            const result = await executeTest(test);
            
            if (result) {
              passedTests++;
              
              // Check if we should exit early in quick mode
              if (QUICK_MODE && passedTests >= MAX_PASSES_IN_QUICK_MODE) {
                console.log(`\n${colors.yellow}Quick mode: ${passedTests} passes reached. Exiting early.${colors.reset}`);
                client.close();
                global.client = null;
                return { total: totalTests, passed: passedTests, failed: failedTests };
              }
            } else {
              failedTests++;
              
              // Check if we should exit early in quick mode or after first failure
              if ((QUICK_MODE && failedTests >= MAX_FAILURES_IN_QUICK_MODE) || !QUICK_MODE) {
                console.log(`${colors.red}${colors.bright}Test failed. Exiting early.${colors.reset}`);
                client.close();
                global.client = null;
                return { total: totalTests, passed: passedTests, failed: failedTests };
              }
            }
          }
        }
      } else {
        // We only know the count but don't have test data
        console.log(`${colors.yellow}  ⚠ Skipping ${testFile.testCount} tests without test data${colors.reset}`);
      }
    } catch (err) {
      console.error(`${colors.red}Error running tests in ${testFile.file}: ${err.message}${colors.reset}`);
    } finally {
      // Close the client to kill the server
      client.close();
      global.client = null;
    }
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
    // Verify the server file exists
    if (!fs.existsSync(SERVER_PATH)) {
      console.error(`${colors.red}REPL server not found: ${SERVER_PATH}${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.cyan}Using server: ${SERVER_PATH}${colors.reset}`);
    
    const testFiles = await loadAllTests();
    const results = await runAllTests(testFiles);

    // Print summary
    console.log(`\n${colors.cyan}${colors.bright}=== Test Summary ===${colors.reset}`);
    console.log(`${colors.cyan}Tests run: ${results.passed + results.failed}/${results.total}${colors.reset}`);
    console.log(`${colors.green}Tests passed: ${results.passed}${colors.reset}`);
    
    if (results.failed > 0) {
      console.log(`${colors.red}Tests failed: ${results.failed}${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`${colors.green}${colors.bright}All tests passed! 🎉${colors.reset}`);
      process.exit(0);
    }
  } catch (err) {
    console.error(`${colors.red}Unexpected error: ${err.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run the main function
main(); 