import * as path from 'node:path';
import * as util from 'node:util';
import * as fs from 'node:fs';
import { debugLog } from '../utils.js';
import * as vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/**
 * Create an execution context for the VM with full Node.js access
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
  
  // Return the complete execution context with direct access to all Node.js globals
  return global;
} 