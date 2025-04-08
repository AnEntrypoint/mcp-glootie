import * as path from 'node:path';
import * as util from 'node:util';
import * as fs from 'node:fs';
import { debugLog } from '../utils.js';
import * as vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/**
 * Create an execution context for the VM with full Node.js access and dynamic import support
 * @param {Array} capturedLogs - Array to capture logs during execution
 * @param {string} workingDir - Working directory for execution
 * @param {Array} processArgv - Process argv array to use for execution
 * @returns {Object} Context object with globals for VM execution
 */
export function createExecutionContext(capturedLogs, workingDir, processArgv = ['node', 'script.js']) {
  // Create timestamp function for log formatting
  const timestamp = () => `[${new Date().toISOString()}]`;
  
  // Log unrestricted mode
  capturedLogs.push(`${timestamp()} Running in unrestricted mode with full Node.js access`);

  // Direct code execution function to bypass VM restrictions
  const directEval = (code) => {
    try {
      return eval(code);
    } catch (err) {
      capturedLogs.push(`${timestamp()} Direct eval failed: ${err.message}`);
      throw err;
    }
  };

  // Create a sandbox with all global object properties
  const sandbox = {};
  Object.getOwnPropertyNames(global).forEach(prop => {
    if (prop !== 'global') {
      try {
        sandbox[prop] = global[prop];
      } catch (err) {
        // Some properties might not be copyable
        debugLog(`Could not copy global property ${prop}: ${err.message}`);
      }
    }
  });

  // Add self-reference to global
  sandbox.global = sandbox;
  
  // Add special direct eval capability
  sandbox.__directEval = directEval;
  
  // Add special handling for dynamic imports
  sandbox.__dynamicImport = async (specifier) => {
    try {
      capturedLogs.push(`${timestamp()} Dynamic import requested for: ${specifier}`);
      return await import(specifier);
    } catch (err) {
      capturedLogs.push(`${timestamp()} Dynamic import failed: ${err.message}`);
      throw err;
    }
  };
  
  // Add special ESM wrapper function that can handle dynamic imports
  sandbox.__importESM = async (code) => {
    try {
      capturedLogs.push(`${timestamp()} ESM import wrapper executing`);
      debugLog('ESM import wrapper executing with code: ' + code.substring(0, 100) + '...');
      
      // Create a temporary file with the ESM code
      const tempDir = path.join(workingDir, 'temp');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create a unique filename for this execution
      const tempFile = path.join(tempDir, `esm-${Date.now()}-${Math.random().toString(36).substring(2)}.mjs`);
      debugLog(`Creating temporary ESM file: ${tempFile}`);
      
      // Wrap the code in an async IIFE if it's not already wrapped
      let processedCode = code;
      if (!code.includes('async () =>') && !code.startsWith('(async () =>')) {
        processedCode = `(async () => {\n${code}\n})()`;
        debugLog('Wrapped code in async IIFE');
      }
      
      // Rewrite import statements to use Node.js dynamic import
      const modifiedCode = processedCode;
      
      // Write the code to the temporary file
      fs.writeFileSync(tempFile, modifiedCode, 'utf8');
      debugLog('Wrote ESM code to temporary file');
      
      try {
        // Import the temporary module
        debugLog(`Importing temporary module: file://${tempFile}`);
        const module = await import(`file://${tempFile}`);
        debugLog('Successfully imported ESM module');
        
        // Extract the default export or the module itself
        let result = module.default;
        
        // If the result is a function that looks like our wrapper, execute it
        if (typeof result === 'function' && result.toString().includes('async')) {
          debugLog('Executing async function from ESM module');
          result = await result();
        }
        
        capturedLogs.push(`${timestamp()} ESM module executed successfully`);
        return result;
      } catch (importErr) {
        debugLog(`Error importing ESM module: ${importErr.message}`);
        capturedLogs.push(`${timestamp()} ESM import error: ${importErr.message}`);
        throw importErr;
      } finally {
        // Clean up the temporary file
        try {
          fs.unlinkSync(tempFile);
          debugLog('Cleaned up temporary ESM file');
        } catch (err) {
          debugLog(`Failed to clean up temporary ESM file: ${err.message}`);
          capturedLogs.push(`${timestamp()} Failed to clean up temporary ESM file: ${err.message}`);
        }
      }
    } catch (err) {
      debugLog(`ESM wrapper failed: ${err.message}`);
      capturedLogs.push(`${timestamp()} ESM import wrapper failed: ${err.message}`);
      throw err;
    }
  };
  
  // Add working directory reference
  sandbox.__workingDir = workingDir;
  
  // Create and return the VM context
  return vm.createContext(sandbox);
} 