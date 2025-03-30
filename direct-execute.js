#!/usr/bin/env node

/**
 * Direct execution tool - Simple Implementation
 * 
 * This tool runs JavaScript files in a subprocess using spawn for better output handling
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Get the file to execute
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node direct-execute.js <file.js>');
  process.exit(1);
}

const filePath = args[0];

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`\n========== EXECUTING ${filePath} ==========\n`);

// Run the file using Node with spawn
const nodeProcess = spawn('node', [filePath], {
  stdio: 'inherit' // This will forward output directly to the console
});

// Handle process completion
nodeProcess.on('close', (code) => {
  if (code === 0) {
    console.log(`\n========== EXECUTION COMPLETED SUCCESSFULLY ==========\n`);
  } else {
    console.error(`\n========== EXECUTION FAILED WITH CODE ${code} ==========\n`);
  }
});

// Handle process errors
nodeProcess.on('error', (error) => {
  console.error(`\n========== EXECUTION ERROR ==========\n`);
  console.error(error.message);
  process.exit(1);
}); 