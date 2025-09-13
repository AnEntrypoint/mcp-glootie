#!/usr/bin/env node
// Streamlined MCP REPL server entry point
// Consolidated from multiple files following KISS principles and DRY patterns

import * as path from 'node:path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { startServer } from './server-core.js';

// Handle version flag
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

// Handle help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('MCP REPL - Code execution and semantic search server');
  console.log('Usage: mcp-glootie [working-directory]');
  console.log('Options:');
  console.log('  --version, -v    Show version');
  console.log('  --help, -h       Show help');
  process.exit(0);
}

// Global error handlers with structured logging for debugging
process.on('uncaughtException', (error) => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    console.error('[UNCAUGHT EXCEPTION]', error);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    console.error('[UNHANDLED REJECTION]', reason);
  }
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    console.error('[SERVER START ERROR]', error);
  }
  process.exit(1);
});