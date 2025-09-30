#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('Creating MCP client to test server...\n');

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'mcp-glootie@latest']
});

const client = new Client(
  {
    name: 'test-client',
    version: '1.0.0'
  },
  {
    capabilities: {}
  }
);

try {
  console.log('Connecting to server...');
  await client.connect(transport);
  console.log('✓ Connected successfully!\n');

  console.log('Listing tools...');
  const tools = await client.listTools();
  console.log(`✓ Found ${tools.tools.length} tools:`);
  tools.tools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description.substring(0, 60)}...`);
  });

  console.log('\n✓ All tests passed! Server is working correctly.');

  await client.close();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}