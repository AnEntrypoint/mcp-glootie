import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { debugLog } from './utils.js';

/**
 * Execute JavaScript code directly with Node.js for seamless import support
 * @param {string} code - The code to execute
 * @param {number} timeout - Timeout in milliseconds
 * @param {string} workingDir - Working directory for execution
 * @returns {Promise<Object>} Execution result with logs and value
 */
export async function executeCodeWithNode(code, timeout = 5000, workingDir = process.cwd()) {
  const timestamp = () => `[${new Date().toISOString()}]`;
  const capturedLogs = [];
  const startTime = Date.now();
  
  // Create a temporary directory for execution
  const tempDir = path.join(workingDir, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create a unique temporary file for this execution
  const tempFile = path.join(tempDir, `node-exec-${Date.now()}-${Math.random().toString(36).substring(2)}.mjs`);
  debugLog(`Creating temporary file for execution: ${tempFile}`);
  
  // Wrap code to capture console output and return values
  const wrappedCode = `
// Capture start time
const __startTime = Date.now();

// Store original console methods
const __originalConsole = { ...console };

// Capture logs
const __logs = [];

// Override console methods to capture output
console.log = (...args) => {
  const formatted = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  __logs.push(formatted);
  __originalConsole.log(...args);
};

console.error = (...args) => {
  const formatted = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  __logs.push('ERROR: ' + formatted);
  __originalConsole.error(...args);
};

console.warn = (...args) => {
  const formatted = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  __logs.push('WARNING: ' + formatted);
  __originalConsole.warn(...args);
};

// Add execution info to logs
__logs.push(\`[${timestamp()}] Running in Node.js with direct execution\`);
__logs.push(\`[${timestamp()}] Using global fetch API\`);

// Store the result of the code execution
let __result;

// Use an async IIFE to allow top-level await
(async () => {
  try {
    // Execute the user code
    __result = await (async () => {
${code}
    })();
  } catch (error) {
    __logs.push(\`[${timestamp()}] Execution error: \${error.message}\`);
    if (error.stack) {
      __logs.push(\`Stack trace: \${error.stack.split('\\n').slice(0, 3).join('\\n')}\`);
    }
    __result = { error: error.message };
  } finally {
    // Calculate execution time
    const __endTime = Date.now();
    const __duration = __endTime - __startTime;
    const __memory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    __logs.push(\`[${timestamp()}] Execution completed in \${__duration}ms (Memory: \${Math.round(__memory * 100) / 100}MB)\`);
    
    // Print results as JSON for easy parsing
    __originalConsole.log('__EXEC_RESULT_START__');
    __originalConsole.log(JSON.stringify({
      success: true,
      result: __result,
      logs: __logs,
      executionTimeMs: __duration,
      memoryUsageMB: Math.round(__memory * 100) / 100
    }));
    __originalConsole.log('__EXEC_RESULT_END__');
  }
})();
`;

  try {
    // Write the code to a temporary file
    fs.writeFileSync(tempFile, wrappedCode, 'utf8');
    
    // Execute the code with Node.js
    return new Promise((resolve, reject) => {
      capturedLogs.push(`${timestamp()} Executing code with Node.js...`);
      
      const nodeProcess = exec(
        `node --experimental-modules --no-warnings ${tempFile}`,
        {
          cwd: workingDir,
          timeout,
          env: process.env
        }
      );
      
      let stdout = '';
      let stderr = '';
      
      nodeProcess.stdout.on('data', (data) => {
        stdout += data;
      });
      
      nodeProcess.stderr.on('data', (data) => {
        stderr += data;
        // Add stderr to captured logs
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            capturedLogs.push(`ERROR: ${line}`);
          }
        });
      });
      
      nodeProcess.on('close', (code) => {
        // Calculate execution time
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
          debugLog('Cleaned up temporary file');
        } catch (err) {
          debugLog(`Failed to clean up temporary file: ${err.message}`);
        }
        
        if (code !== 0) {
          capturedLogs.push(`${timestamp()} Process exited with code ${code}`);
          resolve({
            success: false,
            error: `Process exited with code ${code}`,
            logs: capturedLogs.concat(stderr.split('\n').filter(Boolean))
          });
          return;
        }
        
        // Extract execution result from stdout
        try {
          const resultMatches = stdout.match(/__EXEC_RESULT_START__\n([\s\S]*?)\n__EXEC_RESULT_END__/);
          if (resultMatches && resultMatches[1]) {
            const resultJson = JSON.parse(resultMatches[1]);
            // Combine any logs from the execution with our own logs
            resultJson.logs = capturedLogs.concat(resultJson.logs || []);
            resolve(resultJson);
          } else {
            capturedLogs.push(`${timestamp()} Execution completed in ${duration}ms`);
            resolve({
              success: true,
              result: stdout,
              logs: capturedLogs
            });
          }
        } catch (parseError) {
          capturedLogs.push(`${timestamp()} Error parsing execution result: ${parseError.message}`);
          resolve({
            success: false,
            error: `Error parsing execution result: ${parseError.message}`,
            logs: capturedLogs,
            rawOutput: stdout
          });
        }
      });
      
      nodeProcess.on('error', (err) => {
        capturedLogs.push(`${timestamp()} Execution error: ${err.message}`);
        
        // Clean up temporary file
        try {
          fs.unlinkSync(tempFile);
          debugLog('Cleaned up temporary file');
        } catch (cleanupErr) {
          debugLog(`Failed to clean up temporary file: ${cleanupErr.message}`);
        }
        
        resolve({
          success: false,
          error: err.message,
          logs: capturedLogs
        });
      });
    });
  } catch (err) {
    capturedLogs.push(`${timestamp()} Error setting up execution: ${err.message}`);
    return {
      success: false,
      error: err.message,
      logs: capturedLogs
    };
  }
} 