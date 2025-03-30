import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create the test code file
const testCode = `
// Test the WebSearch service with the updated parameter types
async function testWebSearch() {
  // Configuration
  const SUPABASE_URL = "https://nxmqazntnbzpkhmzwmue.supabase.co";
  const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bXFhem50bmJ6cGtobXp3bXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjcwMTk5MywiZXhwIjoyMDQyMjc3OTkzfQ.luhxDtwUSPxFAoqbNcI3M2jpJJi_LeawyHTKX6V006g";
  
  console.log("Testing WebSearch service unwrapper implementation...");
  
  // Test multiple request formats
  try {
    // Test 1: Using string parameter
    console.log("\\nTest 1: Search with string parameter");
    const response1 = await fetch(\`\${SUPABASE_URL}/functions/v1/wrappedwebsearch\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${SERVICE_ROLE_KEY}\`,
        "apikey": SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        path: ["search"],
        params: "javascript programming"
      })
    });
    
    console.log(\`String parameter test status: \${response1.status}\`);
    const result1 = await response1.json();
    console.log("Success:", result1.success);
    console.log("Result has query:", Boolean(result1.result?.query));
    console.log("Number of results:", result1.result?.results?.length || 0);
    
    // Test 2: Using object parameter with query and limit
    console.log("\\nTest 2: Search with object parameter (query + limit)");
    const response2 = await fetch(\`\${SUPABASE_URL}/functions/v1/wrappedwebsearch\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${SERVICE_ROLE_KEY}\`,
        "apikey": SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        path: ["search"],
        params: {
          query: "artificial intelligence",
          limit: 3
        }
      })
    });
    
    console.log(\`Object parameter test status: \${response2.status}\`);
    const result2 = await response2.json();
    console.log("Success:", result2.success);
    console.log("Result has query:", Boolean(result2.result?.query));
    console.log("Number of results:", result2.result?.results?.length || 0);
    console.log("Limited to 3 results:", result2.result?.results?.length <= 3);
    
    // Test 3: Error case - no query parameter
    console.log("\\nTest 3: Error case - missing query");
    const response3 = await fetch(\`\${SUPABASE_URL}/functions/v1/wrappedwebsearch\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${SERVICE_ROLE_KEY}\`,
        "apikey": SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        path: ["search"],
        params: { limit: 5 }
      })
    });
    
    console.log(\`Error case test status: \${response3.status}\`);
    const result3 = await response3.json();
    console.log("Success:", result3.success);
    console.log("Has error message:", Boolean(result3.error));
    
    return {
      test1: {
        status: response1.status,
        success: result1.success,
        resultCount: result1.result?.results?.length || 0
      },
      test2: {
        status: response2.status,
        success: result2.success,
        resultCount: result2.result?.results?.length || 0,
        limitWorking: result2.result?.results?.length <= 3
      },
      test3: {
        status: response3.status,
        success: result3.success,
        error: result3.error
      },
      allTestsPassed: 
        response1.ok && result1.success && 
        response2.ok && result2.success && 
        response3.ok && !result3.success
    };
  } catch (error) {
    console.error("Test failed with error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
await testWebSearch();
`;

// Save the test code to a file
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const testFilePath = path.join(tempDir, 'websearch-test-code.js');
fs.writeFileSync(testFilePath, testCode);

console.log(`Created test file at: ${testFilePath}`);

// Prepare the REPL test as a JSON-RPC request
const rpcRequest = {
  jsonrpc: '2.0',
  id: '1',
  method: 'callTool',
  params: {
    name: 'execute',
    arguments: {
      code: testCode
    }
  }
};

// Run the server with debug mode and save detailed output
console.log('Starting REPL server in debug mode...');
const server = spawn('node', ['simple-repl-server.js', '--debug']);

let stdoutData = '';
let stderrData = '';

server.stdout.on('data', data => {
  const dataStr = data.toString();
  stdoutData += dataStr;
  console.log('STDOUT:', dataStr);
});

server.stderr.on('data', data => {
  const dataStr = data.toString();
  stderrData += dataStr;
  console.log('STDERR:', dataStr);
});

// Wait for server to start then send the test
setTimeout(() => {
  console.log('Sending WebSearch test to REPL server...');
  server.stdin.write(JSON.stringify(rpcRequest) + '\n');
}, 1000);

// End the test after response has been received
setTimeout(() => {
  console.log('\n--- TEST SUMMARY ---');
  
  // Save all logs to a file for analysis
  const logsDir = path.join(tempDir, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const logFilePath = path.join(logsDir, `websearch-test-${timestamp}.log`);
  
  fs.writeFileSync(logFilePath, `STDOUT:\n${stdoutData}\n\nSTDERR:\n${stderrData}`);
  console.log(`Complete logs saved to: ${logFilePath}`);
  
  // Extract any useful information from the logs
  const fetchErrorMatch = stderrData.match(/Fetch error: (.*?)$/m);
  if (fetchErrorMatch) {
    console.log(`\nDetected fetch error: ${fetchErrorMatch[1]}`);
  }
  
  console.log('\nExecution log analysis:');
  if (stderrData.includes('Executing code in sandbox')) {
    console.log('✓ Code execution was attempted');
  }
  
  if (stderrData.includes('Process completed successfully')) {
    console.log('✓ Process completed successfully');
  } else if (stderrData.includes('Process exited with code')) {
    console.log('✗ Process exited with error');
  }
  
  if (stdoutData.includes('Testing WebSearch service')) {
    console.log('✓ Test code started executing');
  }
  
  if (stdoutData.includes('Test 1: Search with string parameter')) {
    console.log('✓ Test 1 started');
  }
  
  if (stdoutData.includes('fetch is not defined') || stderrData.includes('fetch is not defined')) {
    console.log('✗ Error: fetch is not available in the execution environment');
  }
  
  console.log('\nTerminating server...');
  server.kill();
}, 10000);

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server exited with code: ${code}`);
}); 