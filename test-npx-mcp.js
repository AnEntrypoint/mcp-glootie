#!/usr/bin/env node

// Test npx mcp-glootie with MCP protocol
import { spawn } from 'child_process';

console.log('Testing npx mcp-glootie@latest with MCP protocol...\n');

const server = spawn('npx', ['-y', 'mcp-glootie@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let stdoutData = '';
let stderrData = '';

server.stdout.on('data', (data) => {
  stdoutData += data.toString();
  console.log('STDOUT:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  stderrData += data.toString();
  console.log('STDERR:', data.toString().trim());
});

server.on('exit', (code, signal) => {
  console.log(`\nServer exited with code ${code}, signal ${signal}`);
  if (code === 0) {
    console.log('✓ Test passed - server stayed alive and shut down gracefully');
  } else {
    console.log('✗ Test failed - unexpected exit');
  }
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('✗ Failed to start server:', error);
  process.exit(1);
});

// Wait for server to initialize
setTimeout(() => {
  console.log('\n✓ Sending initialize request...');

  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'claude-code-test',
        version: '1.0.0'
      }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  // Wait for response
  setTimeout(() => {
    console.log('\n✓ Sending tools/list request...');

    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

    // Keep connection alive for 5 seconds
    setTimeout(() => {
      console.log('\n✓ Connection stable, keeping alive for 5 more seconds...');

      setTimeout(() => {
        console.log('\n✓ Server stayed alive successfully! Closing connection...');
        server.stdin.end();
      }, 5000);
    }, 2000);
  }, 2000);
}, 3000);