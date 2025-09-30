#!/usr/bin/env node

console.log('Testing MCP server startup...');

process.env.ENABLE_CONSOLE_OUTPUT = 'true';

async function testServer() {
  try {
    console.log('Importing server module...');
    const module = await import('./src/index.js');
    console.log('Server module imported successfully');
    console.log('Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Still running after 5 seconds');
    process.exit(0);
  } catch (error) {
    console.error('Server startup failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testServer();