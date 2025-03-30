#!/usr/bin/env node

/**
 * Dedicated test for environment variable loading from argv[2]
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Test directory setup
const testDir = path.join(__dirname, 'temp', 'env-test-dir');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Create a test .env file
const envContent = `
# Test .env file with various formats
TEST_VAR1=value1
TEST_VAR2="quoted value"
TEST_VAR3='single quoted'
# Comment line to be ignored
EMPTY_VAR=
TEST_VAR4=123456
`;

const envPath = path.join(testDir, '.env');
fs.writeFileSync(envPath, envContent);
console.log(`Created test .env file at: ${envPath}`);
console.log(`Environment file content:\n${envContent}`);

// Function to test the environment variable loading
function runServer() {
  console.log(`\nStarting server with working directory: ${testDir}`);
  
  // Start the server with our test directory as the working directory
  const server = spawn('node', ['simple-repl-server.js', testDir], {
    stdio: 'pipe'
  });
  
  // Track if we've seen evidence of .env loading
  let envFileDetected = false;
  let varsLoaded = [];
  
  // Listen for server output (stderr)
  server.stderr.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server stderr] ${output.trim()}`);
    
    // Check for .env file loading
    if (output.includes('Loading .env file from') || 
        output.includes('.env file found') || 
        output.includes('Reading .env file')) {
      envFileDetected = true;
    }
    
    // Check for environment variables being set
    const varMatches = output.matchAll(/(?:Set|Setting|Loading|Found) environment variable:?\s+([A-Z_][A-Z0-9_]*)/gi);
    for (const match of varMatches) {
      if (match[1] && !varsLoaded.includes(match[1])) {
        varsLoaded.push(match[1]);
      }
    }
    
    // Alternative pattern for environment variables
    if (output.match(/TEST_VAR\d+/)) {
      const matches = output.match(/TEST_VAR\d+/g);
      for (const match of matches) {
        if (!varsLoaded.includes(match)) {
          varsLoaded.push(match);
          console.log(`Detected variable via content: ${match}`);
        }
      }
    }
  });
  
  // Listen for stdout output as well
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Server stdout] ${output.trim()}`);
    
    // Also check stdout for env loading messages
    if (output.includes('Loading .env file from') || 
        output.includes('.env file found') || 
        output.includes('Reading .env file')) {
      envFileDetected = true;
    }
    
    // Check for environment variables being set in stdout
    const varMatches = output.matchAll(/(?:Set|Setting|Loading|Found) environment variable:?\s+([A-Z_][A-Z0-9_]*)/gi);
    for (const match of varMatches) {
      if (match[1] && !varsLoaded.includes(match[1])) {
        varsLoaded.push(match[1]);
      }
    }
    
    // Alternative pattern for environment variables
    if (output.match(/TEST_VAR\d+/)) {
      const matches = output.match(/TEST_VAR\d+/g);
      for (const match of matches) {
        if (!varsLoaded.includes(match)) {
          varsLoaded.push(match);
          console.log(`Detected variable via content: ${match}`);
        }
      }
    }
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error(`[Server error] ${error.message}`);
    cleanup(false);
  });
  
  // Handle server exit
  server.on('close', (code) => {
    console.log(`[Server] Process exited with code ${code}`);
    if (code !== null && !cleanupDone) {
      cleanup(envFileDetected && varsLoaded.length > 0);
    }
  });
  
  let cleanupDone = false;
  
  // Function to clean up resources
  function cleanup(success) {
    if (cleanupDone) return;
    cleanupDone = true;
    
    console.log('\n=== Test Results ===');
    
    if (envFileDetected) {
      console.log('✅ Server detected .env file in the specified directory');
    } else {
      console.log('❌ Server did not detect .env file');
    }
    
    if (varsLoaded.length > 0) {
      console.log(`✅ Server loaded ${varsLoaded.length} environment variables:`);
      varsLoaded.forEach(varName => console.log(`   - ${varName}`));
    } else {
      console.log('❌ No environment variables were loaded');
    }
    
    // Clean up
    try {
      server.kill();
    } catch (err) {
      // Server may already be closed
    }
    
    try {
      if (fs.existsSync(envPath)) {
        fs.unlinkSync(envPath);
        console.log(`\nDeleted test .env file`);
      }
    } catch (err) {
      console.error(`Error cleaning up .env file: ${err.message}`);
    }
    
    // Exit with appropriate code
    if (success) {
      console.log('\n✅ Test passed: environment variables were successfully loaded from argv[2] directory');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed: environment variables were not loaded correctly');
      process.exit(1);
    }
  }
  
  // Check results after a short timeout
  setTimeout(() => {
    if (!cleanupDone) {
      cleanup(envFileDetected && varsLoaded.length > 0);
    }
  }, 3000);
}

// Run the test
runServer(); 