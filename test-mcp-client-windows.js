#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

console.log('Testing MCP client with Windows cmd /c format...\n');

const transport = new StdioClientTransport({
  command: 'cmd',
  args: ['/c', 'npx', '-y', 'mcp-glootie@latest']
});

const client = new Client(
  {
    name: 'test-client-windows',
    version: '1.0.0'
  },
  {
    capabilities: {}
  }
);

try {
  console.log('Connecting to server with cmd /c npx format...');
  await client.connect(transport);
  console.log('✓ Connected successfully!\n');

  console.log('Listing tools...');
  const tools = await client.listTools();
  console.log(`✓ Found ${tools.tools.length} tools:`);
  tools.tools.forEach(tool => {
    console.log(`  - ${tool.name}`);
  });

  console.log('\n✓ All tests passed! Server works with Windows cmd /c format.');

  await client.close();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}