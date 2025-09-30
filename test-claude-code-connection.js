#!/usr/bin/env node

// Simulate exactly how Claude Code connects to MCP servers
import { spawn } from 'child_process';

console.log('Simulating Claude Code MCP connection...\n');

// This is likely how Claude Code spawns the server
const server = spawn('npx', ['-y', 'mcp-glootie@latest'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let initResponseReceived = false;
let connectionAlive = true;

server.stdout.on('data', (data) => {
  const text = data.toString();
  console.log('[STDOUT]', text.substring(0, 100) + '...');

  if (text.includes('"method":"initialize"') || text.includes('"id":1')) {
    initResponseReceived = true;
    console.log('✓ Initialize response received');
  }
});

server.stderr.on('data', (data) => {
  console.log('[STDERR]', data.toString().trim());
});

server.on('exit', (code, signal) => {
  connectionAlive = false;
  console.log(`\n❌ Server exited after ${Date.now() - startTime}ms with code ${code}, signal ${signal}`);

  if (!initResponseReceived) {
    console.log('❌ Never received initialize response - server died too early');
  }

  process.exit(1);
});

server.on('error', (error) => {
  console.error('❌ Failed to spawn server:', error);
  process.exit(1);
});

const startTime = Date.now();

// Wait a bit for server to start
setTimeout(() => {
  if (!connectionAlive) {
    console.log('❌ Server already dead');
    return;
  }

  console.log('Sending initialize request...');

  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: {
          listChanged: true
        }
      },
      clientInfo: {
        name: 'claude-code',
        version: '1.0.0'
      }
    }
  };

  try {
    server.stdin.write(JSON.stringify(initRequest) + '\n');
  } catch (error) {
    console.error('❌ Failed to write to stdin:', error);
    process.exit(1);
  }

  // Check if server stays alive for 10 seconds
  setTimeout(() => {
    if (connectionAlive && initResponseReceived) {
      console.log(`\n✓ SUCCESS! Server stayed alive for 10 seconds and responded to initialize`);
      server.kill();
      process.exit(0);
    } else if (!connectionAlive) {
      console.log('❌ Server died before 10 seconds');
    } else {
      console.log('❌ Server alive but never responded');
    }
    process.exit(1);
  }, 10000);
}, 1000);