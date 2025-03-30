#!/usr/bin/env node

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

/**
 * Simple MCP tool that executes code via our standalone executor
 * This avoids issues with the main REPL getting stuck
 */

// Create a command executor with proper response handling
function executeCodeWithTool(code) {
  try {
    // Write code to a temporary file
    const tempFilePath = path.join(process.cwd(), 'temp', 'code-to-execute.js');
    fs.writeFileSync(tempFilePath, code);
    
    // Execute the code using our standalone executor
    const result = execSync(
      `node ${path.join(process.cwd(), 'temp', 'mcp-execute.js')} "${tempFilePath}"`,
      { timeout: 15000, encoding: 'utf-8' }
    );
    
    try {
      // Parse the result as JSON
      return JSON.parse(result);
    } catch (parseError) {
      // If not valid JSON, return as text
      return {
        success: true,
        output: result,
        result: result
      };
    }
  } catch (error) {
    console.error('Execution error:', error.message);
    return {
      success: false,
      error: error.message,
      output: error.stderr || error.message
    };
  }
}

// Process the input
function processInput() {
  // Check if we have direct input from command line
  if (process.argv.length > 2) {
    const code = process.argv[2];
    const result = executeCodeWithTool(code);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // Read from stdin for piped input
  let data = '';
  process.stdin.on('data', chunk => {
    data += chunk;
  });
  
  process.stdin.on('end', () => {
    try {
      // Parse the input as JSON if possible
      let codeToExecute;
      try {
        const jsonInput = JSON.parse(data);
        codeToExecute = jsonInput.code || 
                       jsonInput.params?.arguments?.code || 
                       jsonInput;
      } catch (e) {
        // Not valid JSON, treat as raw code
        codeToExecute = data;
      }
      
      // Execute the code
      if (typeof codeToExecute === 'string') {
        const result = executeCodeWithTool(codeToExecute);
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.error('Invalid input: code must be a string');
        process.exit(1);
      }
    } catch (error) {
      console.error('Processing error:', error.message);
      process.exit(1);
    }
  });
}

// Start processing
processInput(); 