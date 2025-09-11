#!/usr/bin/env node

// Temporarily override process.arch for testing
Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });

console.log('Testing with simulated x64 architecture...');
console.log('Process arch:', process.arch);

import('./src/server-core.js').then(async (module) => {
  try {
    console.log('Creating server with x64 simulation...');
    const server = await module.createMCPServer('./test');
    console.log('✓ Server created successfully with full tool handlers');
  } catch (error) {
    console.error('Error:', error.message);
  }
}).catch(console.error);