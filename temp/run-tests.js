// REPL Test Runner
// Run this script to execute test files through the REPL server

const fs = require('fs');
const path = require('path');
const { Client, StdioClientTransport } = require('@modelcontextprotocol/sdk');

// Configuration
const TEST_FILES = [
  'temp/repl-test.js',
  'temp/fetch-test.js',
  'temp/supabase-test.js'
];

// Create MCP client
async function createClient() {
  const client = new Client('test-runner');
  const transport = new StdioClientTransport();
  await client.connect(transport);
  return client;
}

// Execute code in the REPL
async function executeCode(client, code) {
  try {
    const result = await client.callTool('execute', { code });
    return result;
  } catch (error) {
    console.error('Error executing code:', error);
    return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
  }
}

// Format the response for display
function formatResponse(response) {
  if (!response || !response.content) {
    return 'No response received';
  }
  
  return response.content
    .filter(item => item.type === 'text')
    .map(item => item.text)
    .join('\n');
}

// Run a test file
async function runTestFile(client, filePath) {
  console.log(`\n========== RUNNING TEST: ${filePath} ==========\n`);
  
  try {
    // Read the test file
    const code = fs.readFileSync(filePath, 'utf8');
    
    // Execute the code
    const response = await executeCode(client, code);
    
    // Display the result
    console.log(formatResponse(response));
    
    return true;
  } catch (error) {
    console.error(`Error running test file ${filePath}:`, error);
    return false;
  }
}

// Main function
async function main() {
  console.log('REPL Test Runner');
  console.log('===============');
  
  try {
    // Create client
    const client = await createClient();
    console.log('Connected to REPL server');
    
    // Track results
    const results = [];
    
    // Run each test file
    for (const testFile of TEST_FILES) {
      const success = await runTestFile(client, testFile);
      results.push({ file: testFile, success });
    }
    
    // Print summary
    console.log('\n========== TEST SUMMARY ==========');
    for (const result of results) {
      console.log(`${result.success ? '✓' : '✗'} ${result.file}`);
    }
    
    const allPassed = results.every(r => r.success);
    console.log(`\n${allPassed ? 'All tests passed!' : 'Some tests failed!'}`);
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Error in test runner:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error in test runner:', error);
  process.exit(1);
}); 