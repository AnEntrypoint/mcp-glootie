// Minimal REPL template with direct value assignments
const logs = [];
const originalLog = console.log;
const originalError = console.error;

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

// Hardcode CWD value rather than using a function
const CWD_VALUE = process.cwd();

// Create process object with all values
global.process = {
  // Standard properties
  platform: process.platform,
  version: process.version,
  
  // Direct value property instead of function to avoid recursion
  _cwd_value: CWD_VALUE,
  
  // Use a getter for cwd to avoid recursion (safer)
  get cwd() {
    return function() { return this._cwd_value; };
  },
  
  // Empty env object
  env: {},
  
  // Simple nextTick
  nextTick: function(cb) {
    if (typeof cb !== 'function') {
      throw new TypeError('Callback must be a function');
    }
    setTimeout(cb, 0);
  }
};

// Define fetch
global.fetch = async function(url) {
  console.log(`Fetch request to: ${url}`);
  return {
    ok: true,
    status: 200,
    json: async () => ({ message: "Mock response" })
  };
};

// Execute the code
(async () => {
  let result;
  let success = true;
  let error = null;
  
  try {
    // Replace USER_CODE with actual code
    result = await (async () => {
      // USER_CODE
      return "Test successful";
    })();
  } catch (err) {
    success = false;
    error = { 
      message: err.message,
      stack: err.stack
    };
    console.error("Error:", err.message);
  }
  
  // Output final result
  console.log(JSON.stringify({
    success,
    logs,
    result,
    error
  }));
})(); 