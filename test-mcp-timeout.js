#!/usr/bin/env node

// Test what happens during the 2.3 second timeout
import { spawn } from 'child_process';

console.log('Simulating Claude Code MCP connection...\n');

const server = spawn('node', ['src/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString().trim());
});

server.on('exit', (code, signal) => {
  console.log(`\n❌ Server exited with code ${code}, signal ${signal}`);
  process.exit(1);
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Wait for server to start
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
        name: 'claude-code',
        version: '1.0.0'
      }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  // Wait for response, then keep connection open
  setTimeout(() => {
    console.log('\n✓ Connection established, keeping alive for 10 seconds...');

    setTimeout(() => {
      console.log('\n✓ Server stayed alive successfully!');
      server.kill();
      process.exit(0);
    }, 10000);
  }, 2000);
}, 1000);