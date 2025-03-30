/**
 * REPL helper utilities for testing
 */

// Test if a value is defined
function isDefined(value) {
  return typeof value !== 'undefined';
}

// Test deep equality between objects
function isEqual(a, b) {
  if (a === b) return true;
  
  if (typeof a !== 'object' || a === null || 
      typeof b !== 'object' || b === null) {
    return a === b;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => 
    keysB.includes(key) && isEqual(a[key], b[key])
  );
}

// Simple assertion function
function assert(condition, message) {
  if (!condition) {
    throw new Error('Assertion failed: ' + (message || ''));
  }
  return true;
}

// Format values for display
function format(value) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

// Run tests and report results
async function runTests(tests) {
  const results = {
    total: tests.length,
    passed: 0,
    failed: 0,
    details: []
  };
  
  for (const [name, testFn] of Object.entries(tests)) {
    try {
      await testFn();
      results.passed++;
      results.details.push({
        name,
        passed: true
      });
      console.log(`✓ Test passed: ${name}`);
    } catch (error) {
      results.failed++;
      results.details.push({
        name,
        passed: false,
        error: error.message
      });
      console.error(`✗ Test failed: ${name}`);
      console.error(`  Error: ${error.message}`);
    }
  }
  
  console.log(`\nTest summary: ${results.passed}/${results.total} passed`);
  return results;
}

// Return all the helper functions
const replHelper = {
  isDefined,
  isEqual,
  assert,
  format,
  runTests
};

// Export the helpers
replHelper; 