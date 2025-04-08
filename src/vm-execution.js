// This file provides a unified execution model for all code
// regardless of synchronicity, return patterns, or error handling needs

import { executeCode as coreExecuteCode } from './vm/executor.js';
import { debugLog } from './utils.js';
import path from 'path';

/**
 * Execute code with a unified approach that handles all patterns naturally
 * @param {string} code - The code to execute
 * @param {number} timeout - Execution timeout in milliseconds
 * @param {string} workingDir - Working directory for execution
 * @param {Array} processArgv - Process argv array to use for execution
 * @returns {Promise<Object>} - Execution result with consistent format
 */
export async function executeCode(code, timeout, workingDir, processArgv) {
    debugLog(`Executing code in unified executor: length ${code.length}`);

    try {
        // Auto-wrap code if it contains returns but isn't already wrapped
        if (code.includes('return') && 
            !code.startsWith('(') && 
            !code.includes('function') && 
            !code.includes('=>')) {
            code = `(() => { ${code} })()`;
            debugLog('Auto-wrapped code with IIFE to support return statements');
        }

        // Execute the code and get the result
        const result = await coreExecuteCode(code, timeout, workingDir, processArgv);

        // Process common execution issues
        if (!result.success && result.error) {
            // Handle illegal return statement - needs IIFE wrapping
            if (result.error.includes('Illegal return statement')) {
                debugLog('Detected illegal return statement, retrying with IIFE wrapper');
                const wrappedCode = `(() => { ${code} })()`;
                return await coreExecuteCode(wrappedCode, timeout, workingDir, processArgv);
            }
        }

        return result;
    } catch (error) {
        debugLog(`Error in executeCode: ${error.message}`);
        return {
            success: false,
            error: error.message,
            logs: [`[${new Date().toISOString()}] Execution error: ${error.message}`]
        };
    }
} 