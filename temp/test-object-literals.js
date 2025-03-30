import fs from 'fs';
import { spawn } from 'child_process';

// Test case for object literals
const testObjectLiteral = {
  jsonrpc: '2.0',
  id: '1',
  method: 'callTool',
  params: {
    name: 'execute',
    arguments: {
      code: '{ test: true, data: { name: "Test Object" } }'
    }
  }
};

console.log('Starting REPL server to test object literals...');
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

// Wait for server to start
setTimeout(() => {
  console.log('Sending object literal test...');
  server.stdin.write(JSON.stringify(testObjectLiteral) + '\n');
}, 1000);

// End the test after response has been received
setTimeout(() => {
  console.log('\n--- TEST SUMMARY ---');
  console.log('Object literal test completed');
  
  if (stdoutData.includes('"test":true') && stdoutData.includes('"name":"Test Object"')) {
    console.log('✅ SUCCESS: Object literal was properly processed');
  } else {
    console.log('❌ FAILURE: Object literal was not properly processed');
    console.log('Response did not contain expected values');
  }
  
  console.log('\nTerminating server...');
  server.kill();
}, 3000);

// Handle server exit
server.on('exit', (code) => {
  console.log(`Server exited with code: ${code}`);
}); 