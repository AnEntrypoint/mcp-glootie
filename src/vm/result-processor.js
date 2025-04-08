import { debugLog, formatValue, formatError } from '../utils.js';

/**
 * Process the result from VM execution
 * @param {any} result - The raw result from VM execution
 * @param {Array} logs - Captured logs during execution
 * @param {Error} error - Error that occurred during execution, if any
 * @param {Object} executionStats - Stats about the execution (if available)
 * @returns {Object} Processed result with success flag
 */
export function processVMResult(result, logs = [], error = null, executionStats = null) {
    // Error handling
    if (error) {
        debugLog(`Processing error result: ${error.message}`);
        return {
            success: false,
            error: formatError(error),
            logs,
            executionStats
        };
    }

    debugLog(`Processing success result type: ${typeof result}`);

    // Handle Promise-like objects
    if (result && typeof result === 'object' && typeof result.then === 'function') {
        debugLog('Result is a Promise-like object');
        
        // Try to extract resolved value
        if (result.status === 'fulfilled' && 'value' in result) {
            return {
                success: true,
                result: result.value,
                logs,
                executionStats
            };
        }
        
        if (result.status === 'rejected' && 'reason' in result) {
            return {
                success: false,
                error: formatError(result.reason),
                logs,
                executionStats
            };
        }
        
        // If we can't extract a value, return a generic message
        return {
            success: true,
            result: '[Promise]',
            logs,
            executionStats
        };
    }

    // Handle undefined/null
    if (result === undefined || result === null) {
        return {
            success: true,
            result: result === undefined ? 'undefined' : 'null',
            logs,
            executionStats
        };
    }

    // Handle primitive values
    if (typeof result !== 'object' || result === null) {
        return {
            success: true,
            result: result,
            logs,
            executionStats
        };
    }

    // Handle objects with special toString
    if (typeof result.toString === 'function' && 
        result.toString !== Object.prototype.toString) {
        // Special case for Response objects
        if (result.constructor && result.constructor.name === 'Response') {
            debugLog('Detected Response object');
            return {
                success: true,
                result: {
                    status: result.status,
                    statusText: result.statusText,
                    headers: '[Response headers]',
                    body: '[Response body stream]'
                },
                logs,
                executionStats
            };
        }
    }

    // Regular objects - Handle circular references and complex objects
    try {
        return {
            success: true,
            result: result,
            logs,
            executionStats
        };
    } catch (e) {
        debugLog(`Error formatting result: ${e.message}`);
        return {
            success: true,
            result: formatValue(result),
            logs,
            executionStats
        };
    }
} 