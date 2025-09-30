#!/usr/bin/env node

// Test npx.cmd with stdin kept open
import { spawn } from 'child_process';

console.log('Testing npx.cmd -y mcp-glootie@3.4.33...\n');

const server = spawn('cmd', ['/c', 'npx', '-y', 'mcp-glootie@3.4.33'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('STDOUT:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString().trim());
});

server.on('exit', (code, signal) => {
  console.log(`\nServer exited with code ${code}, signal ${signal}`);
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('Failed to start:', error);
  process.exit(1);
});

// Keep stdin open and send initialize after server starts
setTimeout(() => {
  console.log('\nSending initialize request...');

  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    }
  };

  server.stdin.write(JSON.stringify(initRequest) + '\n');

  setTimeout(() => {
    console.log('\nKeeping connection alive for 10 seconds...');

    setTimeout(() => {
      console.log('\nClosing connection...');
      server.stdin.end();
    }, 10000);
  }, 2000);
}, 3000);