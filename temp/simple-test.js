// Basic REPL test script
console.log('REPL execution test starting...');

// Test basic operations
const testResult = {
  string: 'test string',
  number: 42,
  boolean: true,
  array: [1, 2, 3],
  object: { a: 1, b: 2 }
};

// Test console methods
console.log('Log message');
console.info('Info message');
console.warn('Warning message');
console.error('Error message');

// Test process object
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Working directory:', process.cwd());

// Test async/await
async function asyncTest() {
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'Async test complete';
}

// Return the test result
const asyncResult = await asyncTest();
console.log(asyncResult);

// Return the final result object
testResult; 