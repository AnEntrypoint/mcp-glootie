/**
 * Comprehensive test suite for REPL execution
 */

// Define a set of tests to run
const tests = {
  // Test basic value types
  'basic-types': () => {
    // String
    const str = 'test string';
    console.log('String:', str);
    assert(typeof str === 'string', 'String type check failed');
    
    // Number
    const num = 42;
    console.log('Number:', num);
    assert(typeof num === 'number', 'Number type check failed');
    
    // Boolean
    const bool = true;
    console.log('Boolean:', bool);
    assert(typeof bool === 'boolean', 'Boolean type check failed');
    
    // Object
    const obj = { a: 1, b: 'test' };
    console.log('Object:', obj);
    assert(typeof obj === 'object', 'Object type check failed');
    
    // Array
    const arr = [1, 2, 3];
    console.log('Array:', arr);
    assert(Array.isArray(arr), 'Array type check failed');
    
    return true;
  },
  
  // Test console methods
  'console-methods': () => {
    console.log('Testing console.log');
    console.info('Testing console.info');
    console.warn('Testing console.warn');
    console.error('Testing console.error');
    return true;
  },
  
  // Test process object
  'process-object': () => {
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Working directory:', process.cwd());
    
    assert(typeof process.version === 'string', 'process.version should be a string');
    assert(typeof process.platform === 'string', 'process.platform should be a string');
    assert(typeof process.cwd() === 'string', 'process.cwd() should return a string');
    
    return true;
  },
  
  // Test async/await
  'async-await': async () => {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, 100));
    const duration = Date.now() - start;
    
    console.log(`Async delay took ${duration}ms`);
    assert(duration >= 100, 'Async delay should be at least 100ms');
    
    return true;
  },
  
  // Test fetch mock
  'fetch-mock': async () => {
    try {
      const response = await fetch('https://example.com/api');
      const data = await response.json();
      
      console.log('Fetch response:', data);
      assert(data.message === 'Mock response', 'Fetch should return mock data');
      
      return true;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  },
  
  // Test exception handling
  'exception-handling': () => {
    try {
      // This should throw an error
      throw new Error('Test error');
    } catch (error) {
      console.log('Caught error:', error.message);
      assert(error.message === 'Test error', 'Error message should match');
      return true;
    }
    
    // If we get here, the try/catch didn't work
    throw new Error('Exception handling failed');
  }
};

// Helper function for assertions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
  return true;
}

// Run all tests
async function runTests() {
  console.log('Starting REPL environment test suite...');
  
  const results = {
    total: Object.keys(tests).length,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  for (const [name, testFn] of Object.entries(tests)) {
    console.log(`\nRunning test: ${name}`);
    try {
      const result = testFn();
      // Handle async tests
      if (result instanceof Promise) {
        await result;
      }
      
      results.passed++;
      results.details.push({ name, status: 'passed' });
      console.log(`✅ Test passed: ${name}`);
    } catch (error) {
      results.failed++;
      results.details.push({ 
        name, 
        status: 'failed',
        error: error.message 
      });
      console.error(`❌ Test failed: ${name}`);
      console.error(`   Error: ${error.message}`);
    }
  }
  
  // Print summary
  console.log('\n----- Test Summary -----');
  console.log(`Total: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log('------------------------\n');
  
  return results;
}

// Run tests and return results
await runTests(); 