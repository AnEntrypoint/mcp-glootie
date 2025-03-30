// REPL execution template - CommonJS version
// Used for running all test cases

// Console capture setup
const logs = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

// Override console methods
console.log = function(...args) {
  const formatted = args.join(' ');
  logs.push(['log', formatted]);
  originalLog(...args);
};

console.error = function(...args) {
  const formatted = args.join(' ');
  logs.push(['error', formatted]);
  originalError(...args);
};

console.warn = function(...args) {
  const formatted = args.join(' ');
  logs.push(['warn', formatted]);
  originalWarn(...args);
};

console.info = function(...args) {
  const formatted = args.join(' ');
  logs.push(['info', formatted]);
  originalInfo(...args);
};

// Define fixed values for process
const WORKING_DIR = __dirname;
const PLATFORM = process.platform;
const VERSION = process.version;

// Create safe process object
global.process = {
  // String properties
  platform: PLATFORM,
  version: VERSION,
  
  // Return a fixed string
  cwd: function() { return WORKING_DIR; },
  
  // Empty environment variables
  env: { NODE_ENV: 'test', PATH: '/usr/local/bin:/usr/bin:/bin' },
  
  // Safe nextTick implementation
  nextTick: function(callback) { setTimeout(callback, 0); }
};

// Implement fetch
global.fetch = async function(url, options = {}) {
  console.log(`Fetch request to: ${url}`);
  const response = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => '{"message":"Mock response"}',
    json: async () => ({ message: "Mock response" })
  };
  return response;
};

// Execute the test code
(async function runTest() {
  let result = undefined;
  let success = true;
  let error = null;
  
  try {
    // This will be replaced with actual test code
    result = await (async () => {
      // TEST_CODE_PLACEHOLDER
      return "Test result";
    })();
  } catch (err) {
    success = false;
    error = {
      message: err.message,
      stack: err.stack
    };
    console.error('Error:', err.message);
  }
  
  // Print result for test runner to parse
  console.log('TEST_RESULT:', JSON.stringify({
    success,
    result,
    logs,
    error
  }));
})(); 