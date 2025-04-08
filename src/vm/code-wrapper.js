import { debugLog } from '../utils.js';

/**
 * Wraps code to be executed in the VM context
 * @param {string} code - The code to execute
 * @returns {string} - The wrapped code ready for execution
 */
export function wrapCode(code) {
  debugLog('Wrapping code for execution');

  // Clean up the code
  const cleanedCode = code.trim();
  
  // Check if the code is already wrapped in an async IIFE
  if (cleanedCode.startsWith('(async') || cleanedCode.startsWith('async ') || cleanedCode.match(/^\(\s*async/)) {
    debugLog('Code is already using async syntax, preserving as-is');
    return ensureAsyncWrapper(cleanedCode);
  }

  // Check if the code is already wrapped in an IIFE
  if (cleanedCode.startsWith('(') && cleanedCode.endsWith(')()') || 
      cleanedCode.startsWith('(() =>') || 
      cleanedCode.startsWith('(function')) {
    debugLog('Code is already wrapped in an IIFE, preserving as-is');
    return ensureAsyncWrapper(cleanedCode);
  }

  // Check if the code has return statement - needs IIFE
  if (cleanedCode.includes('return ') || /\breturn;/.test(cleanedCode)) {
    debugLog('Code has return statement, adding IIFE wrapper');
    return `(async () => {
      try {
        return (() => { ${cleanedCode} })();
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }

  // For any code, ensure it's wrapped in an async IIFE with error handling
  debugLog('Adding standard async wrapper with error handling');
  return `(async () => {
    try {
      ${cleanedCode}
    } catch (e) {
      console.error('ERROR:', e);
      throw e;
    }
  })()`;
}

/**
 * Ensures code is properly wrapped in an async IIFE with error handling
 * @param {string} code - The code to wrap
 * @returns {string} - The wrapped code
 */
function ensureAsyncWrapper(code) {
  // If code is already an async IIFE but missing error handling
  if ((code.includes('async') && code.includes('=>') && !code.includes('try {')) ||
      (code.includes('async function') && !code.includes('try {'))) {
    
    // Extract the inner function body
    const bodyMatch = code.match(/{\s*([\s\S]*?)\s*}(?:\s*\(\s*\)\s*)?$/);
    if (bodyMatch && bodyMatch[1]) {
      const functionBody = bodyMatch[1].trim();
      
      return `(async () => {
        try {
          ${functionBody}
        } catch (e) {
          console.error('ERROR:', e);
          throw e;
        }
      })()`;
    }
  }
  
  // If code is already a well-formed async IIFE, return as-is
  if (code.startsWith('(async') && code.includes('try {') && code.includes('catch')) {
    return code;
  }

  // Fallback - wrap in a new async IIFE
  return `(async () => {
    try {
      return ${code};
    } catch (e) {
      console.error('ERROR:', e);
      throw e;
    }
  })()`;
} 