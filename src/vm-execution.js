// This file provides a unified execution model for all code
// regardless of synchronicity, return patterns, or error handling needs

import { executeCode as coreExecuteCode } from './vm/index.js';
import { debugLog } from './utils.js';

/**
 * Execute code with a unified approach that handles all patterns naturally
 * @param {string} code - The code to execute
 * @param {number} timeout - Execution timeout in milliseconds
 * @param {string} workingDir - Working directory for execution
 * @returns {Promise<Object>} - Execution result with consistent format
 */
export async function executeCode(code, timeout, workingDir) {
    debugLog(`Executing code in unified executor: ${code.substring(0, 50)}...`);

    // Detect if this code involves network operations
    const hasNetworkOperations = code.includes('fetch(') || 
        code.includes('http://') || 
        code.includes('https://') ||
        code.includes('await') && (code.includes('get') || code.includes('post'));
    
    // For network operations, we need a longer timeout
    if (hasNetworkOperations) {
        const adjustedTimeout = Math.max(timeout, 15000);
        debugLog(`Network operations detected, using adjusted timeout: ${adjustedTimeout}ms`);
        timeout = adjustedTimeout;
    }
    
    // More comprehensive test detection
    const isTestCode = code.includes('Test.assert') || 
                       code.includes('expect(') || 
                       code.includes('assertEquals') ||
                       code.includes('typeof expected') ||
                       code.includes('assert') ||
                       code.includes('.should.') ||
                       code.includes('should.equal');
    
    // Detect if this code explicitly contains object literals
    const hasObjectLiteral = (code.includes('{') && code.includes(':') && code.includes('}')) ||
                            code.includes('new Object') ||
                            code.includes('Object.create');
                            
    // Detect if this code is using async/await or promises
    const isAsyncCode = code.includes('async ') || 
                        code.includes('await ') || 
                        code.includes('Promise.') ||
                        code.includes('new Promise') ||
                        code.includes('.then(') ||
                        code.includes('.catch(');
                        
    // Detect ES6 features that might need special handling
    const hasES6Features = code.includes('=>') || // Arrow functions
                          code.includes('class ') || // Classes
                          code.includes('...') || // Spread operator
                          code.includes('const {') || // Destructuring
                          code.includes('const [') ||
                          code.includes('let {') ||
                          code.includes('let [');

    // Special detection for 'await' at the top-level which needs special handling
    const hasTopLevelAwait = code.trim().startsWith('await ') || 
                             code.includes(';\nawait ') || 
                             code.includes('; await ');
                              
    // Check if the code has a bare return statement which would cause syntax errors
    const hasBareReturn = code.trim() === 'return' || 
                          code.trim().startsWith('return\n') ||
                          code.includes(';\nreturn\n') ||
                          code.includes('; return\n');
                          
    // Create a wrapper to ensure that the code runs in a proper context
    let wrappedCode = code;
    
    // Check if the code was wrapped by our caller (avoid double-wrapping)
    const isAlreadyWrapped = code.includes('async () =>') || code.startsWith('(async () =>');
    
    // Check if there's a return statement that needs wrapping
    const hasReturnStatement = code.includes('return ') || hasBareReturn;
    
    // Check for any kind of special cases that might need wrapping
    const needsWrapper = (hasReturnStatement || hasTopLevelAwait) && !isAlreadyWrapped;
    
    // Only wrap the code if needed and it's not already wrapped
    if (!isAlreadyWrapped) {
        // Handle bare 'return' without a value
        if (hasBareReturn) {
            wrappedCode = code.replace(/return(\s*)(;?)/, 'return undefined$1$2');
            debugLog('Fixed bare return statement without a value');
        }
        
        if (needsWrapper) {
            // For async code or top-level await, use proper async IIFE pattern
            if (isAsyncCode || hasTopLevelAwait) {
                wrappedCode = `
                (async () => {
                    try {
                        ${wrappedCode}
                    } catch (error) {
                        console.error('Execution error:', error.message);
                        throw error;
                    }
                })()
                `;
                debugLog(`Wrapped async code with explicit error handling`);
            }
            // For ES6 features, ensure proper context
            else if (hasES6Features) {
                wrappedCode = `
                (() => {
                    try {
                        ${wrappedCode}
                    } catch (error) {
                        console.error('ES6 execution error:', error.message);
                        throw error;
                    }
                })()
                `;
                debugLog(`Wrapped ES6 code with proper context`);
            }
            // For any other code with returns, use a simple IIFE
            else {
                wrappedCode = `
                (() => {
                    ${wrappedCode}
                })()
                `;
                debugLog(`Wrapped return-containing code with IIFE`);
            }
        }
        // For object literals that should be returned but don't have a return statement
        else if (hasObjectLiteral && !hasReturnStatement && !code.includes(';')) {
            // If it's a single object literal expression, wrap with a return
            wrappedCode = `(()=>{return ${code}})()`;
            debugLog('Wrapped single object literal without return');
        }
        // For other code without return statements, just keep as is
        else {
            debugLog('Keeping code as-is, no wrapping needed');
        }
    } else {
        debugLog('Code already has proper wrapper, keeping as-is');
    }
    
    // Add metadata about the code type for result processor
    const metadata = {
        isTestCode,
        hasObjectLiteral,
        isAsyncCode,
        hasES6Features,
        hasNetworkOperations,
        hasTopLevelAwait
    };
    
    // Simply delegate to the core VM executor with enhanced code
    const result = await coreExecuteCode(wrappedCode, timeout, workingDir);
    
    // Add metadata to execution result
    if (result && typeof result === 'object') {
        result.metadata = metadata;
    }
    
    return result;
} 