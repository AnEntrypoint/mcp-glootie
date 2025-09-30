#!/usr/bin/env node

// Test the MCP server with actual JSON-RPC protocol messages
import { spawn } from 'child_process';

console.log('Starting MCP protocol test...\n');

const server = spawn('node', ['src/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let stdoutData = '';
let stderrData = '';

server.stdout.on('data', (data) => {
  stdoutData += data.toString();
  console.log('STDOUT:', data.toString());
});

server.stderr.on('data', (data) => {
  stderrData += data.toString();
  console.log('STDERR:', data.toString());
});

server.on('exit', (code, signal) => {
  console.log(`\nServer exited with code ${code}, signal ${signal}`);
  console.log('\nStdout buffer:', stdoutData);
  console.log('\nStderr buffer:', stderrData);
  process.exit(code || 0);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Wait for server to initialize
setTimeout(() => {
  console.log('\nSending initialize request...');

  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };

  const message = JSON.stringify(initRequest) + '\n';
  console.log('Sending:', message);

  server.stdin.write(message);

  // Wait for response
  setTimeout(() => {
    console.log('\nSending list tools request...');

    const listToolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    const toolsMessage = JSON.stringify(listToolsRequest) + '\n';
    console.log('Sending:', toolsMessage);

    server.stdin.write(toolsMessage);

    // Wait for response then close
    setTimeout(() => {
      console.log('\nClosing connection...');
      server.stdin.end();

      setTimeout(() => {
        if (!server.killed) {
          console.log('Force killing server...');
          server.kill();
        }
      }, 1000);
    }, 2000);
  }, 2000);
}, 1000);