#!/usr/bin/env node
// Simple Test Runner for MCP REPL Server

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

// Get current directory 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Paths
const SERVER_PATH = path.join(rootDir, 'universal-repl-server.js');
const TESTS_DIR = path.join(rootDir, 'tests');

// Check paths
console.log(`Server path: ${SERVER_PATH}`);
console.log(`Tests directory: ${TESTS_DIR}`);

console.log('Checking if files exist:');
console.log(`- Server exists: ${fs.existsSync(SERVER_PATH)}`);
console.log(`- Tests dir exists: ${fs.existsSync(TESTS_DIR)}`);

// Debug mode
const DEBUG = true;

// Debug log function
function debug(msg) {
  if (DEBUG) {
    console.log(`[DEBUG] ${msg}`);
  }
}

// Test the server spawn
async function testServerSpawn() {
  console.log('\nTesting server spawn...');
  
  try {
    // Resolve the server path
    const resolvedPath = path.resolve(SERVER_PATH);
    console.log(`Resolved server path: ${resolvedPath}`);
    
    // Start the server process
    const serverProcess = spawn('node', [resolvedPath, '--debug'], {
      stdio: 'pipe',
      cwd: rootDir
    });
    
    // Check if spawn succeeded
    if (!serverProcess || !serverProcess.pid) {
      console.error('Failed to spawn server process');
      return false;
    }
    
    console.log(`Server process started with PID: ${serverProcess.pid}`);
    
    // Set up event handlers
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server stdout: ${data.toString().trim()}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.log(`Server stderr: ${data.toString().trim()}`);
    });
    
    // Give the server a moment to start up
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Kill the server
    serverProcess.kill();
    console.log('Server process killed');
    
    return true;
  } catch (err) {
    console.error(`Error spawning server: ${err.message}`);
    return false;
  }
}

// Find all test files
function findTestFiles() {
  console.log('\nLooking for test files...');
  
  try {
    if (!fs.existsSync(TESTS_DIR)) {
      console.error(`Tests directory not found: ${TESTS_DIR}`);
      return [];
    }
    
    const files = fs.readdirSync(TESTS_DIR)
      .filter(file => file.endsWith('.js') && !file.startsWith('_'))
      .filter(file => file !== 'README.md');
    
    console.log(`Found ${files.length} test files:`);
    files.forEach(file => console.log(`- ${file}`));
    
    return files;
  } catch (err) {
    console.error(`Error finding test files: ${err.message}`);
    return [];
  }
}

// Main function
async function main() {
  console.log('=== Simple MCP REPL Test Runner ===\n');
  
  // Check if server exists
  if (!fs.existsSync(SERVER_PATH)) {
    console.error(`Server file not found: ${SERVER_PATH}`);
    process.exit(1);
  }
  
  // Test spawning the server
  const serverSuccess = await testServerSpawn();
  console.log(`Server spawn test: ${serverSuccess ? 'SUCCESS' : 'FAILED'}`);
  
  // Find test files
  const testFiles = findTestFiles();
  console.log(`Found ${testFiles.length} test files`);
  
  console.log('\nTest completed');
}

// Run the main function
main().catch(err => {
  console.error(`Unexpected error: ${err.message}`);
  process.exit(1);
}); 