// REPL execution wrapper template
// This will be copied and code inserted for each REPL execution

// Define console capture for logs
const logs = [];

// Store original console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

// Simple object formatter
function formatValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

// Override console methods with safer versions
console.log = function(...args) {
  const formatted = args.map(arg => 
    typeof arg === 'string' ? arg : formatValue(arg)
  ).join(' ');
  logs.push(['log', formatted]);
  originalLog('[log]', ...args);
};

console.error = function(...args) {
  const formatted = args.map(arg => 
    typeof arg === 'string' ? arg : formatValue(arg)
  ).join(' ');
  logs.push(['error', formatted]);
  originalError('[error]', ...args);
};

console.warn = function(...args) {
  const formatted = args.map(arg => 
    typeof arg === 'string' ? arg : formatValue(arg)
  ).join(' ');
  logs.push(['warn', formatted]);
  originalWarn('[warn]', ...args);
};

console.info = function(...args) {
  const formatted = args.map(arg => 
    typeof arg === 'string' ? arg : formatValue(arg)
  ).join(' ');
  logs.push(['info', formatted]);
  originalInfo('[info]', ...args);
};

// Create a plain process object with direct string properties
// Use constants to avoid circular references
const WORKING_DIR = process.cwd();
const PLATFORM = process.platform;
const VERSION = process.version;

// Override the global process object
global.process = {
  // Fixed string properties
  platform: PLATFORM,
  version: VERSION,
  
  // Method returning a fixed string
  cwd: function() { return WORKING_DIR; },
  
  // Empty environment vars
  env: {},
  
  // Simple nextTick implementation
  nextTick: function(callback) {
    setTimeout(callback, 0);
  }
};

// Implement fetch
global.fetch = async function(url, options = {}) {
  console.log(`Fetch request to: ${url}`);
  
  // Mock response
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => '{"message": "Mock response"}',
    json: async () => ({ message: "Mock response" })
  };
};

// Simple test execution - this would be replaced with actual code
async function runUserCode() {
  // USER CODE WILL BE INSERTED HERE
  console.log("REPL template is working");
  return { success: true };
}

// Main execution
(async () => {
  let result;
  let success = true;
  let error = null;
  
  try {
    // Run the user code
    result = await runUserCode();
  } catch (err) {
    success = false;
    error = {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
    console.error('Execution error:', err.message);
  }
  
  // Return the results
  const output = {
    success,
    logs,
    result,
    error
  };
  
  // Output as JSON for parsing
  console.log(JSON.stringify(output));
})(); 