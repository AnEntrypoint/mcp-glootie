import * as path from 'node:path';
import * as util from 'node:util';
import * as fs from 'node:fs';
import { debugLog } from '../utils.js';

// Set of modules that are considered safe for loading in the VM context
const SAFE_MODULES = new Set([
  'fs', 'path', 'util', 'crypto', 'stream', 'events',
  'assert', 'buffer', 'child_process', 'console', 'constants',
  'string_decoder', 'timers', 'tty', 'url', 'querystring',
  'zlib', 'http', 'https', 'net', 'dgram', 'dns', 'tls', 'os'
]);

/**
 * Create an execution context for the VM with enhanced resource tracking and safer module loading
 * @param {Array} capturedLogs - Array to capture logs during execution
 * @param {string} workingDir - Working directory for execution
 * @returns {Object} Context object with globals for VM execution
 */
export function createExecutionContext(capturedLogs, workingDir) {
  const resources = {
    timers: new Set(),
    intervals: new Set(),
    immediates: new Set(),
    abortControllers: new Set(),
    promises: new Set(),
    openFiles: new Set(),
    fetches: new Set(),
    stats: {
      timerCount: 0,
      intervalCount: 0,
      immediateCount: 0,
      promiseCount: 0,
      abortControllerCount: 0,
      openFileCount: 0,
      fetchCount: 0,
      maxConcurrentTimers: 0,
      maxConcurrentIntervals: 0,
      maxConcurrentImmediates: 0,
      maxConcurrentPromises: 0,
      maxConcurrentAbortControllers: 0,
      maxConcurrentOpenFiles: 0,
      maxConcurrentFetches: 0
    }
  };
  
  // Create timestamp function for log formatting
  const timestamp = () => `[${new Date().toISOString()}]`;
  
  // Helper function to format log values
  const formatLogValue = (val) => {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    
    try {
      if (typeof val === 'object') {
        return util.inspect(val, { depth: 2, colors: false });
      }
      return String(val);
    } catch (error) {
      return `[Error formatting log value: ${error.message}]`;
    }
  };
  
  // Create the console object with enhanced methods
  const console = {
    // Capture all console output
    log: (...args) => {
      const logStr = args.map(formatLogValue).join(' ');
      const logWithTime = `${timestamp()} ${logStr}`;
      capturedLogs.push(logWithTime);
      return undefined;
    },
    error: (...args) => {
      const logStr = args.map(formatLogValue).join(' ');
      const logWithTime = `${timestamp()} ERROR: ${logStr}`;
      capturedLogs.push(logWithTime);
      return undefined;
    },
    warn: (...args) => {
      const logStr = args.map(formatLogValue).join(' ');
      const logWithTime = `${timestamp()} WARN: ${logStr}`;
      capturedLogs.push(logWithTime);
      return undefined;
    },
    info: (...args) => {
      const logStr = args.map(formatLogValue).join(' ');
      const logWithTime = `${timestamp()} INFO: ${logStr}`;
      capturedLogs.push(logWithTime);
      return undefined;
    },
    debug: (...args) => {
      const logStr = args.map(formatLogValue).join(' ');
      const logWithTime = `${timestamp()} DEBUG: ${logStr}`;
      capturedLogs.push(logWithTime);
      return undefined;
    },
    dir: (obj, options) => {
      try {
        const output = util.inspect(obj, { ...(options || {}), colors: false });
        capturedLogs.push(`${timestamp()} DIR: ${output}`);
      } catch (error) {
        capturedLogs.push(`${timestamp()} ERROR: Failed to format object for dir: ${error.message}`);
      }
      return undefined;
    },
    table: (tabularData, properties) => {
      try {
        let result;
        if (typeof tabularData === 'object' && tabularData !== null) {
                if (Array.isArray(tabularData)) {
            result = JSON.stringify(tabularData, null, 2);
          } else {
            const entries = Object.entries(tabularData);
            result = entries.map(([k, v]) => `${k}: ${formatLogValue(v)}`).join('\n');
          }
                } else {
          result = formatLogValue(tabularData);
                }
        capturedLogs.push(`${timestamp()} TABLE:\n${result}`);
      } catch (error) {
        capturedLogs.push(`${timestamp()} ERROR: Failed to format table data: ${error.message}`);
            }
      return undefined;
        },
    trace: (...args) => {
            const err = new Error();
      const stack = err.stack.split('\n').slice(2).join('\n');
      const logStr = args.map(formatLogValue).join(' ');
      capturedLogs.push(`${timestamp()} TRACE: ${logStr}\n${stack}`);
      return undefined;
    },
    // Time tracking methods
    time: (label = 'default') => {
      console._timers = console._timers || {};
      console._timers[label] = Date.now();
      capturedLogs.push(`${timestamp()} TIME: Started timer "${label}"`);
      return undefined;
    },
    timeEnd: (label = 'default') => {
      console._timers = console._timers || {};
      if (console._timers[label]) {
        const duration = Date.now() - console._timers[label];
        capturedLogs.push(`${timestamp()} TIMEEND: Timer "${label}" finished in ${duration}ms`);
        delete console._timers[label];
            } else {
        capturedLogs.push(`${timestamp()} TIMEEND: Timer "${label}" does not exist`);
            }
      return undefined;
        },
    // Assertion
    assert: (condition, ...args) => {
            if (!condition) {
        const message = args.length > 0 ? args.map(formatLogValue).join(' ') : 'Assertion failed';
        capturedLogs.push(`${timestamp()} ASSERTION FAILED: ${message}`);
      }
      return undefined;
    },
    // Clear - just logs a separator in our capturedLogs
    clear: () => {
      capturedLogs.push(`${timestamp()} CONSOLE CLEARED ------------------------------`);
      return undefined;
    },
    // Count methods
    count: (label = 'default') => {
      console._counters = console._counters || {};
      console._counters[label] = (console._counters[label] || 0) + 1;
      capturedLogs.push(`${timestamp()} COUNT: ${label}: ${console._counters[label]}`);
      return undefined;
    },
    countReset: (label = 'default') => {
      console._counters = console._counters || {};
      console._counters[label] = 0;
      capturedLogs.push(`${timestamp()} COUNT RESET: ${label}`);
      return undefined;
    },
    // Group methods - simple implementation for captured logs
    group: (...args) => {
      const groupTitle = args.length > 0 ? args.map(formatLogValue).join(' ') : 'Group';
      capturedLogs.push(`${timestamp()} GROUP START: ${groupTitle} -------------`);
      return undefined;
    },
    groupEnd: () => {
      capturedLogs.push(`${timestamp()} GROUP END -----------------------------`);
      return undefined;
    },
    // Resource usage reporting
    resourceUsage: () => {
      const usage = getResourceStats();
      const formattedUsage = formatLogValue(usage);
      capturedLogs.push(`${timestamp()} RESOURCE USAGE: ${formattedUsage}`);
      return usage;
    }
  };
  
  // Add global Buffer support
  const addBufferSupport = () => {
    try {
      const nodeBuffer = globalThis.Buffer || require('buffer').Buffer;
      
      // Basic Buffer implementation if needed
      class SafeBuffer extends Uint8Array {
        constructor(arg) {
          if (typeof arg === 'number') {
            super(arg);
          } else if (typeof arg === 'string') {
            const encoder = new TextEncoder();
            const uint8Array = encoder.encode(arg);
            super(uint8Array);
          } else if (Array.isArray(arg)) {
            super(arg);
          } else if (arg instanceof Uint8Array) {
            super(arg);
          } else {
            super(0);
          }
        }
        
        static from(value, encoding) {
          if (typeof value === 'string') {
            const encoder = new TextEncoder();
            return new SafeBuffer(encoder.encode(value));
          }
          return new SafeBuffer(value);
        }
        
        static concat(buffers, totalLength) {
          if (!totalLength) {
            totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
          }
          const result = new SafeBuffer(totalLength);
          let offset = 0;
          for (const buf of buffers) {
            result.set(buf, offset);
            offset += buf.length;
          }
          return result;
        }
        
        toString(encoding) {
          const decoder = new TextDecoder(encoding || 'utf-8');
          return decoder.decode(this);
        }
      }
      
      return nodeBuffer || SafeBuffer;
    } catch (e) {
      debugLog(`Error creating Buffer polyfill: ${e.message}`);
      
      // Fallback minimal Buffer implementation
      return class MinimalBuffer extends Uint8Array {
        toString() { return '[Buffer]'; }
        static from() { return new MinimalBuffer(); }
        static concat() { return new MinimalBuffer(); }
      };
    }
  };
  
  const BufferClass = addBufferSupport();
  
  // Enhanced Promise class with resource tracking
  class TrackedPromise extends Promise {
    constructor(executor) {
      // Create a flag to track initialization status
      let isInitialized = false;
      
      // Create a value store for return values
      let returnValueStore = undefined;
      
      // Track this promise with a unique ID
      const id = `promise-${resources.stats.promiseCount++}`;
      
      // Add special tracking capabilities to preserve return values
      super((resolve, reject) => {
        const wrappedResolve = (value) => {
          // Store the value being resolved for later retrieval
          if (value !== undefined) {
            returnValueStore = value;
            debugLog(`TrackedPromise storing return value: ${typeof value}`);
          }
          // Clean up tracking when resolved
          resources.promises.delete(id);
          resolve(value);
        };
        
        const wrappedReject = (reason) => {
          // Clean up tracking when rejected
          resources.promises.delete(id);
          reject(reason);
        };
        
        try {
          executor(wrappedResolve, wrappedReject);
          isInitialized = true;
        } catch (error) {
          resources.promises.delete(id);
          reject(error);
        }
      });
      
      // Store ID and value references
      this._id = id;
      this._valueFromReturn = returnValueStore;
      
      // Track this promise in resources
      resources.promises.add(id);
      
      // Update stats
      if (resources.promises.size > resources.stats.maxConcurrentPromises) {
        resources.stats.maxConcurrentPromises = resources.promises.size;
      }
      
      debugLog(`Created tracked promise ${id}, total active: ${resources.promises.size}`);
    }
    
    // Override then to maintain tracking and preserve values
    then(onFulfilled, onRejected) {
      return super.then(
        // Wrap the onFulfilled callback to preserve return values
        onFulfilled ? (value) => {
          try {
            const result = onFulfilled(value);
            // If the result is not undefined, add it to the promise
            if (result !== undefined && result !== null) {
              if (result instanceof Promise || (result && typeof result.then === 'function')) {
                // For promise results, we'll let the constructor handle it
                return result;
              } else {
                // For direct values, create a promise with the value
                const wrappedResult = Promise.resolve(result);
                wrappedResult._valueFromReturn = result;
                return wrappedResult;
              }
            }
            return result;
          } catch (error) {
            throw error;
          }
        } : undefined,
        onRejected
      );
    }
    
    // Override catch to maintain tracking
    catch(onRejected) {
      return super.catch(onRejected);
    }
    
    // Override finally to maintain tracking (but avoid infinite recursion)
    finally(onFinally) {
      return super.finally(onFinally);
    }
    
    // Static methods with string id handling
    static resolve(value) {
      return new TrackedPromise((resolve) => resolve(value));
    }
    
    static reject(reason) {
      return new TrackedPromise((_, reject) => reject(reason));
    }
    
    static all(promises) {
      return new TrackedPromise((resolve, reject) => {
        Promise.all(promises).then(resolve).catch(reject);
      });
    }
    
    static race(promises) {
      return new TrackedPromise((resolve, reject) => {
        Promise.race(promises).then(resolve).catch(reject);
      });
    }
    
    static allSettled(promises) {
      return new TrackedPromise((resolve, reject) => {
        Promise.allSettled(promises).then(resolve).catch(reject);
      });
    }
    
    static any(promises) {
      return new TrackedPromise((resolve, reject) => {
        Promise.any(promises).then(resolve).catch(reject);
      });
    }
  }
  
  // Enhanced fetch with tracking
  function trackedFetch(...args) {
    debugLog(`Fetch called in VM context: ${args[0]}`);
    capturedLogs.push(`[${new Date().toISOString()}] Initiating fetch to ${args[0]}`);
    
    // Create a unique ID for this fetch operation
    const fetchId = `fetch-${resources.stats.fetchCount++}`;
    resources.fetches.add(fetchId);
    
    // Update stats
    if (resources.fetches.size > resources.stats.maxConcurrentFetches) {
      resources.stats.maxConcurrentFetches = resources.fetches.size;
    }
    
    debugLog(`Created tracked fetch ${fetchId}, total active: ${resources.fetches.size}`);
    
    // Add timeout logic for this specific fetch
    const controller = new TrackedAbortController();
    const originalOptions = args[1] || {};
    const options = { ...originalOptions };
    
    // Combine with original signal if present
    if (options.signal) {
      const originalSignal = options.signal;
      originalSignal.addEventListener('abort', () => {
        controller.abort(originalSignal.reason);
      });
    }
    
    // Set our controllable signal
    options.signal = controller.signal;
    
    // Create a tracker for this specific fetch operation
    let isCompleted = false;
    let pendingOperations = 0;
    
    // Apply timeout - default 15s for fetch operations to ensure completions
    const timeoutId = setTimeout(() => {
      debugLog(`Fetch ${fetchId} timeout exceeded`);
      capturedLogs.push(`[${new Date().toISOString()}] Fetch ${fetchId} timed out after 15000ms`);
      controller.abort(new Error('Fetch timeout exceeded'));
    }, 15000);
    
    // Create the enhanced fetch promise
    const fetchPromise = fetch(args[0], options);
    
    // Helper to mark this fetch as completed
    const markCompleted = () => {
      if (isCompleted) return;
      
      clearTimeout(timeoutId);
      resources.fetches.delete(fetchId);
      isCompleted = true;
      debugLog(`Fetch ${fetchId} marked as completely finished`);
    };
    
    // Helper to track pending operations (like .json() and .text())
    const trackOperation = () => {
      pendingOperations++;
      debugLog(`Fetch ${fetchId} has ${pendingOperations} pending operations`);
    };
    
    const untrackOperation = () => {
      pendingOperations--;
      debugLog(`Fetch ${fetchId} has ${pendingOperations} pending operations remaining`);
      
      // When all pending operations are done, mark as completed
      if (pendingOperations <= 0) {
        markCompleted();
      }
    };
    
    // Create tracked promise with proper cleanup
    const trackedPromise = new TrackedPromise((resolve, reject) => {
      fetchPromise
        .then(response => {
          // Initial network request completed, but response might not be processed yet
          debugLog(`Fetch ${fetchId} completed successfully with status ${response.status}`);
          capturedLogs.push(`[${new Date().toISOString()}] Fetch completed successfully: ${args[0]} (${response.status})`);
          
          // If the response is never used, we mark as completed
          // This gets overridden if .json() or .text() is called
          setTimeout(() => {
            if (pendingOperations === 0) {
              markCompleted();
            }
          }, 50);
          
          // Wrap response methods to ensure they're properly tracked too
          const originalJson = response.json;
          const originalText = response.text;
          
          response.json = function() {
            trackOperation();
            debugLog(`Parsing JSON response for fetch ${fetchId}`);
            const jsonPromise = originalJson.call(this);
            return new TrackedPromise((jsonResolve, jsonReject) => {
              jsonPromise
                .then(jsonData => {
                  debugLog(`JSON parsing completed for fetch ${fetchId}`);
                  capturedLogs.push(`[${new Date().toISOString()}] JSON data received for ${args[0]}`);
                  jsonResolve(jsonData);
                  untrackOperation();
                })
                .catch(error => {
                  debugLog(`JSON parsing error for fetch ${fetchId}: ${error.message}`);
                  capturedLogs.push(`[${new Date().toISOString()}] JSON parsing error: ${error.message}`);
                  jsonReject(error);
                  untrackOperation();
                });
            });
          };
          
          response.text = function() {
            trackOperation();
            debugLog(`Getting text response for fetch ${fetchId}`);
            const textPromise = originalText.call(this);
            return new TrackedPromise((textResolve, textReject) => {
              textPromise
                .then(textData => {
                  debugLog(`Text retrieval completed for fetch ${fetchId}`);
                  capturedLogs.push(`[${new Date().toISOString()}] Text data received for ${args[0]}`);
                  textResolve(textData);
                  untrackOperation();
                })
                .catch(error => {
                  debugLog(`Text retrieval error for fetch ${fetchId}: ${error.message}`);
                  capturedLogs.push(`[${new Date().toISOString()}] Text retrieval error: ${error.message}`);
                  textReject(error);
                  untrackOperation();
                });
            });
          };
          
          resolve(response);
        })
        .catch(error => {
          // Cleanup resources
          markCompleted();
          debugLog(`Fetch ${fetchId} failed: ${error.message}`);
          capturedLogs.push(`[${new Date().toISOString()}] Fetch error: ${error.message}`);
          reject(error);
        });
    });
    
    return trackedPromise;
  }
  
  // Enhanced AbortController with tracking
  class TrackedAbortController {
    constructor() {
      const id = resources.stats.abortControllerCount++;
      this._controller = new AbortController();
      this._id = id;
      
      resources.abortControllers.add(id);
      
      // Update stats
      if (resources.abortControllers.size > resources.stats.maxConcurrentAbortControllers) {
        resources.stats.maxConcurrentAbortControllers = resources.abortControllers.size;
      }
      
      debugLog(`Created tracked AbortController ${id}, total: ${resources.abortControllers.size}`);
    }
    
    get signal() {
      return this._controller.signal;
    }
    
    abort(reason) {
      this._controller.abort(reason);
      resources.abortControllers.delete(this._id);
      return undefined;
    }
  }
  
  // Create enhanced setTimeout with tracking
  function trackedSetTimeout(callback, delay, ...args) {
    const id = setTimeout(() => {
      try {
        callback(...args);
      } finally {
        resources.timers.delete(trackingId);
        debugLog(`Timer ${trackingId} completed, remaining: ${resources.timers.size}`);
      }
    }, delay);
    
    const trackingId = resources.stats.timerCount++;
    resources.timers.add(trackingId);
    
    // Update stats
    if (resources.timers.size > resources.stats.maxConcurrentTimers) {
      resources.stats.maxConcurrentTimers = resources.timers.size;
    }
    
    debugLog(`Created tracked setTimeout ${trackingId}, total: ${resources.timers.size}`);
    return id;
  }
  
  // Create enhanced setInterval with tracking
  function trackedSetInterval(callback, delay, ...args) {
    const id = setInterval(() => {
      try {
        callback(...args);
      } catch (error) {
        debugLog(`Error in interval ${trackingId}: ${error.message}`);
        clearInterval(id);
        resources.intervals.delete(trackingId);
      }
    }, delay);
    
    const trackingId = resources.stats.intervalCount++;
    resources.intervals.add(trackingId);
    
    // Update stats
    if (resources.intervals.size > resources.stats.maxConcurrentIntervals) {
      resources.stats.maxConcurrentIntervals = resources.intervals.size;
    }
    
    debugLog(`Created tracked setInterval ${trackingId}, total: ${resources.intervals.size}`);
    return id;
  }
  
  // Create enhanced setImmediate with tracking
  function trackedSetImmediate(callback, ...args) {
    const id = setImmediate(() => {
      try {
        callback(...args);
      } finally {
        resources.immediates.delete(trackingId);
        debugLog(`Immediate ${trackingId} completed, remaining: ${resources.immediates.size}`);
      }
    });
    
    const trackingId = resources.stats.immediateCount++;
    resources.immediates.add(trackingId);
    
    // Update stats
    if (resources.immediates.size > resources.stats.maxConcurrentImmediates) {
      resources.stats.maxConcurrentImmediates = resources.immediates.size;
    }
    
    debugLog(`Created tracked setImmediate ${trackingId}, total: ${resources.immediates.size}`);
    return id;
  }
  
  // Enhanced clearTimeout with tracking
  function trackedClearTimeout(id) {
    if (id) {
      clearTimeout(id);
      // We can't reliably map the timer ID back to our tracking symbol
      // but we can still try to clean up any matching timers
      resources.timers.forEach(trackingId => {
        if (String(trackingId).includes(`-${id}`)) {
          resources.timers.delete(trackingId);
          debugLog(`Timer ${trackingId} cleared, remaining: ${resources.timers.size}`);
        }
      });
    }
    return undefined;
  }
  
  // Enhanced clearInterval with tracking
  function trackedClearInterval(id) {
    if (id) {
      clearInterval(id);
      // We can't reliably map the interval ID back to our tracking symbol
      // but we can still try to clean up any matching intervals
      resources.intervals.forEach(trackingId => {
        if (String(trackingId).includes(`-${id}`)) {
          resources.intervals.delete(trackingId);
          debugLog(`Interval ${trackingId} cleared, remaining: ${resources.intervals.size}`);
        }
      });
    }
    return undefined;
  }
  
  // Enhanced clearImmediate with tracking
  function trackedClearImmediate(id) {
    if (id) {
      clearImmediate(id);
      // We can't reliably map the immediate ID back to our tracking symbol
      // but we can still try to clean up any matching immediates
      resources.immediates.forEach(trackingId => {
        if (String(trackingId).includes(`-${id}`)) {
          resources.immediates.delete(trackingId);
          debugLog(`Immediate ${trackingId} cleared, remaining: ${resources.immediates.size}`);
        }
      });
    }
    return undefined;
  }
  
  // Function to get resource usage statistics
  function getResourceStats() {
    return {
      timers: {
        active: resources.timers.size,
        total: resources.stats.timerCount,
        max: resources.stats.maxConcurrentTimers
      },
      intervals: {
        active: resources.intervals.size,
        total: resources.stats.intervalCount,
        max: resources.stats.maxConcurrentIntervals
      },
      immediates: {
        active: resources.immediates.size,
        total: resources.stats.immediateCount,
        max: resources.stats.maxConcurrentImmediates
      },
      promises: {
        active: resources.promises.size,
        total: resources.stats.promiseCount,
        max: resources.stats.maxConcurrentPromises
      },
      abortControllers: {
        active: resources.abortControllers.size,
        total: resources.stats.abortControllerCount,
        max: resources.stats.maxConcurrentAbortControllers
      },
      files: {
        active: resources.openFiles.size,
        total: resources.stats.openFileCount,
        max: resources.stats.maxConcurrentOpenFiles
      },
      fetches: {
        active: resources.fetches.size,
        total: resources.stats.fetchCount,
        max: resources.stats.maxConcurrentFetches
      }
    };
  }
  
  // Clean up all tracked resources
  function cleanupResources() {
    let totalCleanupCount = 0;
    
    // Clean up timers
    resources.timers.forEach(id => {
      debugLog(`Cleaning up timer ${id}`);
      totalCleanupCount++;
    });
    resources.timers.clear();
    
    // Clean up intervals
    resources.intervals.forEach(id => {
      debugLog(`Cleaning up interval ${id}`);
      totalCleanupCount++;
    });
    resources.intervals.clear();
    
    // Clean up immediates
    resources.immediates.forEach(id => {
      debugLog(`Cleaning up immediate ${id}`);
      totalCleanupCount++;
    });
    resources.immediates.clear();
    
    // Clean up abort controllers
    resources.abortControllers.forEach(id => {
      debugLog(`Cleaning up AbortController ${id}`);
      totalCleanupCount++;
    });
    resources.abortControllers.clear();
    
    // Note: We can't directly clean up promises, but we can track them
    const promiseCount = resources.promises.size;
    if (promiseCount > 0) {
      debugLog(`Found ${promiseCount} unresolved promises during cleanup`);
      resources.promises.clear();
      totalCleanupCount += promiseCount;
    }
    
    // Clean up open files
    resources.openFiles.forEach(id => {
      try {
        debugLog(`Closing file ${id}`);
        const fileDescriptor = id.split('-').pop();
        fs.closeSync(parseInt(fileDescriptor, 10));
      } catch (error) {
        debugLog(`Error closing file ${id}: ${error.message}`);
      }
      totalCleanupCount++;
    });
    resources.openFiles.clear();
    
    // Clean up pending fetch operations
    const fetchCount = resources.fetches.size;
    if (fetchCount > 0) {
      debugLog(`Found ${fetchCount} pending fetch operations during cleanup`);
      capturedLogs.push(`[${new Date().toISOString()}] Cleaning up ${fetchCount} pending fetch operations`);
      resources.fetches.clear();
      totalCleanupCount += fetchCount;
    }
    
    return totalCleanupCount;
  }
  
  // Safe require function that only allows certain modules
  function safeRequire(moduleName) {
    if (!SAFE_MODULES.has(moduleName)) {
      debugLog(`Attempt to load unsafe module: ${moduleName}`);
      capturedLogs.push(`${timestamp()} SECURITY WARNING: Attempted to load unsafe module: ${moduleName}`);
      throw new Error(`Module '${moduleName}' is not allowed in this environment. Only the following modules are allowed: ${Array.from(SAFE_MODULES).join(', ')}`);
    }
    
    debugLog(`Loading safe module: ${moduleName}`);
    
    try {
      // Handle special modules
      if (moduleName === 'buffer') {
        return { Buffer: SafeBuffer };
      }
      
      if (moduleName === 'util') {
        return {
          inspect: util.inspect,
          format: util.format,
          promisify: util.promisify,
          types: {
            isBuffer: (obj) => obj instanceof SafeBuffer,
            isDate: (obj) => obj instanceof Date,
            isRegExp: (obj) => obj instanceof RegExp
          }
        };
      }
      
      if (moduleName === 'fs') {
        // Return simplified fs functions that work with the workingDir
        return {
          readFileSync: (filePath, options) => {
            try {
              const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workingDir, filePath);
              
              const content = fs.readFileSync(fullPath, options);
              capturedLogs.push(`${timestamp()} Read file synchronously: ${fullPath}`);
              return content;
            } catch (error) {
              capturedLogs.push(`${timestamp()} Error reading file: ${error.message}`);
              throw error;
            }
          },
          writeFileSync: (filePath, data, options) => {
            try {
              const fullPath = path.isAbsolute(filePath) 
                ? filePath 
                : path.join(workingDir, filePath);
              
              capturedLogs.push(`${timestamp()} Write file synchronously: ${fullPath}`);
              // For test safety, prevent writing outside workingDir
              if (!fullPath.startsWith(workingDir)) {
                throw new Error('Cannot write outside working directory');
              }
              
              return fs.writeFileSync(fullPath, data, options);
            } catch (error) {
              capturedLogs.push(`${timestamp()} Error writing file: ${error.message}`);
              throw error;
            }
          },
          existsSync: (filePath) => {
            try {
              const fullPath = path.isAbsolute(filePath)
                ? filePath
                : path.join(workingDir, filePath);
              
              return fs.existsSync(fullPath);
            } catch (error) {
              return false;
            }
          }
        };
      }
      
      if (moduleName === 'path') {
        return {
          join: path.join,
          resolve: path.resolve,
          basename: path.basename,
          dirname: path.dirname,
          extname: path.extname,
          isAbsolute: path.isAbsolute
        };
      }
      
      if (moduleName === 'url') {
        return { 
          URL: globalThis.URL,
          URLSearchParams: globalThis.URLSearchParams,
          parse: (url) => new URL(url),
          format: (urlObj) => urlObj.toString()
        };
      }
      
      // Use the node: prefix to ensure we get the built-in module
      return require(`node:${moduleName}`);
    } catch (error) {
      debugLog(`Error loading module ${moduleName}: ${error.message}`);
      capturedLogs.push(`${timestamp()} ERROR: Failed to load module ${moduleName}: ${error.message}`);
      throw new Error(`Cannot find module '${moduleName}'`);
    }
  }
  
  // Create mock process object with enhanced functionality
  const process = {
    cwd: () => workingDir,
    argv: ['node', 'script.js'],
    env: { ...global.process.env, NODE_ENV: 'development' },
    // Enhanced resourceUsage method
    resourceUsage: () => {
      const realUsage = global.process.resourceUsage ? global.process.resourceUsage() : {};
      const enhancedUsage = {
        ...realUsage,
        customResources: getResourceStats()
      };
      return enhancedUsage;
    },
    // Implement hrtime for testing
    hrtime: (time) => {
      const now = process.uptime() * 1e9;
      if (!time) {
        return [Math.floor(now / 1e9), now % 1e9];
      }
      const diff = now - (time[0] * 1e9 + time[1]);
      return [Math.floor(diff / 1e9), diff % 1e9];
    },
    // Add hrtime.bigint method
    uptime: () => {
      // Simple implementation, in reality this would return system uptime
      return Date.now() / 1000;
    },
    nextTick: (callback, ...args) => {
      setImmediate(() => callback(...args));
      return undefined;
    },
    exit: (code) => {
      debugLog(`Process.exit called with code ${code}`);
      capturedLogs.push(`${timestamp()} Process exit requested with code: ${code}`);
      throw new Error(`Process.exit(${code}) called`);
    },
    // Other common process properties
    platform: global.process.platform,
    arch: global.process.arch,
    version: global.process.version,
    versions: global.process.versions,
  };

  // Add hrtime.bigint
  process.hrtime.bigint = () => {
    const [seconds, nanoseconds] = process.hrtime();
    return BigInt(seconds) * BigInt(1e9) + BigInt(nanoseconds);
  };

  // Safe buffer implementation
  class SafeBuffer {
    constructor(arg, encodingOrOffset, length) {
      if (typeof arg === 'number') {
        this._buffer = Buffer.alloc(arg);
      } else if (typeof arg === 'string') {
        this._buffer = Buffer.from(arg, encodingOrOffset);
      } else if (Array.isArray(arg)) {
        this._buffer = Buffer.from(arg);
      } else if (arg instanceof ArrayBuffer || ArrayBuffer.isView(arg)) {
        this._buffer = Buffer.from(arg, encodingOrOffset, length);
      } else {
        this._buffer = Buffer.from(String(arg));
      }
    }
    
    // Add buffer methods
    toString(encoding, start, end) {
      return this._buffer.toString(encoding, start, end);
    }
    
    write(string, offset, length, encoding) {
      return this._buffer.write(string, offset, length, encoding);
    }
    
    slice(start, end) {
      return new SafeBuffer(this._buffer.slice(start, end));
    }
    
    // Make sure buffer behaves like an array/view
    get length() {
      return this._buffer.length;
    }
    
    // Allow indexing operations
    [Symbol.iterator]() {
      return this._buffer[Symbol.iterator]();
    }
  }

  // Add static methods
  SafeBuffer.from = function(...args) {
    return new SafeBuffer(...args);
  };

  SafeBuffer.alloc = function(size, fill, encoding) {
    const buf = new SafeBuffer(size);
    if (fill !== undefined) {
      buf._buffer.fill(fill, 0, size, encoding);
    }
    return buf;
  };

  SafeBuffer.allocUnsafe = function(size) {
    return new SafeBuffer(size);
  };

  SafeBuffer.concat = function(list, totalLength) {
    const buffers = list.map(buf => buf._buffer || buf);
    const result = Buffer.concat(buffers, totalLength);
    return new SafeBuffer(result);
  };

  // Response class for fetch
  class Response {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = new Headers(options.headers);
      this.type = options.type || 'default';
      this.url = options.url || '';
    }
    
    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
    
    text() {
      return Promise.resolve(String(this.body));
    }
    
    arrayBuffer() {
      return Promise.resolve(new ArrayBuffer(0));
    }
  }

  // Headers API for fetch tests
  class Headers {
    constructor(init) {
      this._headers = new Map();
      
      if (init) {
        if (typeof init === 'object') {
          const pairs = Array.isArray(init) ? init : Object.entries(init);
          for (const [key, value] of pairs) {
            this.append(key, value);
          }
        }
      }
    }
    
    append(name, value) {
      const key = name.toLowerCase();
      const values = this._headers.get(key) || [];
      values.push(String(value));
      this._headers.set(key, values);
    }
    
    delete(name) {
      this._headers.delete(name.toLowerCase());
    }
    
    get(name) {
      const values = this._headers.get(name.toLowerCase());
      return values ? values.join(', ') : null;
    }
    
    has(name) {
      return this._headers.has(name.toLowerCase());
    }
    
    set(name, value) {
      this._headers.set(name.toLowerCase(), [String(value)]);
    }
    
    forEach(callback, thisArg) {
      for (const [key, values] of this._headers) {
        callback.call(thisArg, values.join(', '), key, this);
      }
    }
  }

  // Exports the main context object
  const context = {
    console,
    process,
    setTimeout: trackedSetTimeout,
    clearTimeout: trackedClearTimeout,
    setInterval: trackedSetInterval,
    clearInterval: trackedClearInterval,
    setImmediate: trackedSetImmediate,
    clearImmediate: trackedClearImmediate,
    Promise: TrackedPromise,
    require: safeRequire,
    fetch: trackedFetch,
    AbortController: TrackedAbortController,
    Headers,
    Response,
    Buffer: SafeBuffer,
    
    // Include some standard global objects
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Math,
    RegExp,
    JSON,
    Error,
    TypeError,
    SyntaxError,
    ReferenceError,
    RangeError,
    URIError,
    EvalError,
    
    // Standard constructors
    Map,
    Set,
    WeakMap,
    WeakSet,
    ArrayBuffer,
    Uint8Array,
    Int8Array,
    Uint16Array,
    Int16Array,
    Uint32Array,
    Int32Array,
    Float32Array,
    Float64Array,
    
    // Add global property
    global: { process },
    
    // Utility methods for resource management
    getResourceStats,
    cleanupResources,
  };

  // Add global.process for compatibility
  context.global = { process };
  
  // Add self-referential global for compatibility
  context.global.global = context.global;
  
  // Make process.env accessible for tests
  context.process.env = { ...process.env };
  
  // Add Promise.withResolvers for Node.js 20+ compatibility
  if (!TrackedPromise.withResolvers) {
    TrackedPromise.withResolvers = function() {
      let resolve, reject;
      const promise = new TrackedPromise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
  
  // Add debug hooks if needed
  if (process.env.DEBUG === 'true' || process.argv.includes('--debug')) {
    context.__resources = resources;
  }
    
    return context;
} 