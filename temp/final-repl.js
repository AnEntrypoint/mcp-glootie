// Final REPL environment template
const logs = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

// Console capture functions
console.log = function(...args) {
  const formatted = args.join(' ');
  logs.push(['log', formatted]);
  originalLog('[log]', ...args);
};

console.error = function(...args) {
  const formatted = args.join(' ');
  logs.push(['error', formatted]);
  originalError('[error]', ...args);
};

console.warn = function(...args) {
  const formatted = args.join(' ');
  logs.push(['warn', formatted]);
  originalWarn('[warn]', ...args);
};

console.info = function(...args) {
  const formatted = args.join(' ');
  logs.push(['info', formatted]);
  originalInfo('[info]', ...args);
};

// Create working directory as plain string value
const WORKING_DIR = "/working/directory";
const PLATFORM = "win32";
const VERSION = "v23.10.0";

// Define a fresh process object without any references to the real process
const safeProcess = {
  // Simple string properties
  platform: PLATFORM,
  version: VERSION,
  
  // Fixed working directory
  _cwd: WORKING_DIR,
  
  // Return a plain string to avoid recursion
  cwd: () => WORKING_DIR,
  
  // Empty env object
  env: {},
  
  // Safe nextTick implementation
  nextTick: (callback) => setTimeout(callback, 0)
};

// Replace the global process object
global.process = safeProcess;

// Simple fetch implementation
global.fetch = async (url, options = {}) => {
  console.log(`Fetch request to: ${url}`);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map([['content-type', 'application/json']]),
    text: async () => '{"message":"Mock response"}',
    json: async () => ({ message: "Mock response" })
  };
};

// Execute user code
(async () => {
  let result;
  let success = true;
  let error = null;
  
  try {
    // USER_CODE will be replaced with actual code
    result = await (async () => {
      // USER_CODE
      return { status: "ok" };
    })();
  } catch (err) {
    success = false;
    error = {
      message: err.message,
      stack: err.stack
    };
    console.error('Error executing code:', err.message);
  }
  
  // Output the result in JSON format for parsing
  console.log(JSON.stringify({
    success,
    logs,
    result,
    error
  }));
})(); 