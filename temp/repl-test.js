// Simple REPL test suite
// Run this file in the REPL to verify functionality

async function testBasicJS() {
  console.log("Testing basic JS functionality...");
  
  // Test variables and basic operations
  const num = 42;
  const str = "Hello, REPL!";
  const arr = [1, 2, 3, 4, 5];
  const obj = { name: "REPL", version: 1.0 };
  
  console.log("Variables defined successfully");
  console.log(`Number: ${num}, String: ${str}`);
  console.log(`Array sum: ${arr.reduce((a, b) => a + b, 0)}`);
  console.log(`Object: ${JSON.stringify(obj)}`);
  
  // Test error handling
  try {
    const x = nonExistentVariable;
    console.log("Should not reach here");
  } catch (error) {
    console.log("Error handling works:", error.message);
  }
  
  return true;
}

async function testPromises() {
  console.log("Testing Promises and async/await...");
  
  // Test async/await
  const delay = (ms) => new Promise(resolve => setTimeout(() => resolve(`Delayed for ${ms}ms`), ms));
  
  try {
    const result = await delay(100);
    console.log("Async/await works:", result);
    
    // Test Promise.all
    const results = await Promise.all([
      delay(50).then(() => "First"),
      delay(30).then(() => "Second"),
      delay(10).then(() => "Third")
    ]);
    console.log("Promise.all works:", results);
    
    // Test Promise.race
    const raceResult = await Promise.race([
      delay(30).then(() => "Fast"),
      delay(50).then(() => "Medium"),
      delay(100).then(() => "Slow")
    ]);
    console.log("Promise.race works:", raceResult);
    
    return true;
  } catch (error) {
    console.error("Promise test failed:", error);
    return false;
  }
}

async function testGlobals() {
  console.log("Testing global objects and functions...");
  
  try {
    // Test console methods
    console.log("Standard console.log");
    console.warn("Warning message");
    console.error("Error message");
    console.info("Info message");
    
    // Test JSON
    const obj = { test: "value", nested: { works: true } };
    const jsonStr = JSON.stringify(obj);
    const parsed = JSON.parse(jsonStr);
    console.log("JSON works:", parsed.nested.works === true);
    
    // Test Buffer
    const buf = Buffer.from("REPL Test");
    console.log("Buffer works:", buf.toString() === "REPL Test");
    
    // Test URL
    const url = new URL("https://example.com/path?query=test");
    console.log("URL works:", url.hostname === "example.com" && url.searchParams.get("query") === "test");
    
    // Test process existence
    console.log("Process exists:", typeof process !== "undefined");
    if (typeof process !== "undefined") {
      console.log("Node version:", process.version);
      console.log("Current working directory:", process.cwd());
    }
    
    // Test AbortController
    const controller = new AbortController();
    console.log("AbortController works:", controller.signal instanceof AbortSignal);
    
    return true;
  } catch (error) {
    console.error("Globals test failed:", error);
    return false;
  }
}

async function testImports() {
  console.log("Testing dynamic imports...");
  
  try {
    // Try importing a core Node.js module
    const path = await import('path');
    console.log("Core module import works:", typeof path.join === "function");
    
    // Try using the imported module
    const result = path.join("dir", "file.js");
    console.log("Import usage works:", result === "dir/file.js" || result === "dir\\file.js");
    
    return true;
  } catch (error) {
    console.error("Import test failed:", error.stack || error.message);
    return false;
  }
}

async function testFetch() {
  console.log("Testing fetch functionality...");
  
  try {
    // Test basic fetch against a public API
    const response = await fetch('https://httpbin.org/get');
    console.log("Fetch request succeeded:", response.status === 200);
    
    // Test response handling
    const data = await response.json();
    console.log("Response parsing works:", typeof data === 'object');
    
    // Test timeout and error handling
    try {
      await Promise.race([
        fetch('https://httpbin.org/delay/5'), // Request that will take too long
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
      ]);
      console.log("Should not reach here");
    } catch (error) {
      console.log("Timeout handling works:", error.message);
    }
    
    // Test POST request with body
    const postResponse = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'value' })
    });
    
    const postData = await postResponse.json();
    console.log("POST request works:", postData.json && postData.json.test === 'value');
    
    // Test URL normalization
    const relativeResponse = await fetch('httpbin.org/get');
    console.log("URL normalization works:", relativeResponse.status === 200);
    
    return true;
  } catch (error) {
    console.error("Fetch test failed:", error.message);
    return false;
  }
}

async function testUrlUtils() {
  console.log("Testing URL utilities...");
  
  try {
    // Test URL normalization if available
    if (typeof urlUtils !== 'undefined') {
      console.log("URL utilities exist:", true);
      
      // Test normalizeUrl function
      const normalized = urlUtils.normalizeUrl('example.com');
      console.log("URL normalization:", normalized === 'https://example.com');
      
      // Test isValidUrl function
      console.log("Valid URL check:", urlUtils.isValidUrl('https://example.com') === true);
      console.log("Invalid URL check:", urlUtils.isValidUrl('not-a-url') === false);
      
      // Test joinPaths function if available
      if (urlUtils.joinPaths) {
        const joined = urlUtils.joinPaths('api', 'v1', 'users');
        console.log("Path joining:", joined === 'api/v1/users');
      }
      
      return true;
    } else {
      // Fallback tests for standard URL
      const url = new URL('https://example.com/path');
      console.log("Standard URL API works:", url.hostname === 'example.com');
      
      return true;
    }
  } catch (error) {
    console.error("URL utilities test failed:", error.message);
    return false;
  }
}

async function testFileSystem() {
  console.log("Testing filesystem access...");
  
  try {
    // Check if fs module is available
    if (typeof fs === 'undefined') {
      console.log("Filesystem access is not available in this environment");
      return true;
    }
    
    // Get current directory contents
    const files = fs.readdirSync('.');
    console.log("Directory listing works:", Array.isArray(files) && files.length > 0);
    console.log("Files in current directory:", files.slice(0, 5).join(', ') + (files.length > 5 ? '...' : ''));
    
    // Test file writing/reading
    const testFilePath = './temp-test-file.txt';
    
    // Write test file
    fs.writeFileSync(testFilePath, 'Hello from REPL test');
    console.log("File writing works:", fs.existsSync(testFilePath));
    
    // Read test file
    const content = fs.readFileSync(testFilePath, 'utf8');
    console.log("File reading works:", content === 'Hello from REPL test');
    
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log("File deletion works:", !fs.existsSync(testFilePath));
    
    return true;
  } catch (error) {
    console.error("Filesystem test failed:", error.message);
    return false;
  }
}

async function testEnvironmentVars() {
  console.log("Testing environment variables...");
  
  try {
    // Check for process.env
    console.log("process.env exists:", typeof process.env === 'object');
    
    // Check standard Node.js environment variables
    console.log("NODE_ENV:", process.env.NODE_ENV || '(not set)');
    console.log("PATH exists:", !!process.env.PATH);
    
    // Test environmental utility functions if available
    if (typeof utils !== 'undefined' && utils.getEnv) {
      const testEnv = utils.getEnv('TEST_VAR', 'default value');
      console.log("getEnv utility works:", testEnv === (process.env.TEST_VAR || 'default value'));
    }
    
    // Check for Supabase-related environment variables
    const hasSupabaseVars = !!(process.env.SUPABASE_URL && 
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
    
    console.log("Supabase environment variables are configured:", hasSupabaseVars);
    
    return true;
  } catch (error) {
    console.error("Environment test failed:", error.message);
    return false;
  }
}

async function testSupabaseHelper() {
  console.log("Testing Supabase helper...");
  
  try {
    // Check if supabaseHelper exists in the environment
    if (typeof supabaseHelper === 'undefined') {
      console.log("Supabase helper not available");
      return true; // Not a failure if not available
    }
    
    console.log("Supabase helper exists:", !!supabaseHelper);
    
    // Check for needed environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log("Skipping Supabase client tests due to missing environment variables");
      return true;
    }
    
    // Test client creation method if available
    if (supabaseHelper.createClient) {
      try {
        const client = supabaseHelper.createClient(supabaseUrl, supabaseKey);
        console.log("Supabase client creation works:", !!client);
        
        // Test a simple query to verify the connection
        const { data, error } = await client.from('_dummy_query_').select('*').limit(1);
        if (error && error.code !== '42P01') { // Ignore table not found errors
          throw error;
        }
        console.log("Supabase connection works");
      } catch (error) {
        if (error.message && error.message.includes('not available')) {
          console.log("Supabase SDK not installed:", error.message);
          return true;
        }
        throw error;
      }
    }
    
    return true;
  } catch (error) {
    console.error("Supabase helper test failed:", error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log("Testing error handling...");
  
  try {
    // Test basic error creation and properties
    const basicError = new Error('Basic error');
    console.log("Basic error creation works:", basicError.message === 'Basic error');
    
    // Test try/catch with throw
    try {
      throw new Error('Expected error');
    } catch (e) {
      console.log("Try/catch works:", e.message === 'Expected error');
    }
    
    // Test error with custom properties
    const customError = new Error('Custom error');
    customError.code = 'ERR_CUSTOM';
    customError.statusCode = 400;
    
    console.log("Custom error properties work:", 
      customError.code === 'ERR_CUSTOM' && customError.statusCode === 400);
    
    // Test asynchronous error handling
    let asyncErrorCaught = false;
    try {
      await Promise.reject(new Error('Async error'));
    } catch (e) {
      asyncErrorCaught = true;
      console.log("Async error handling works:", e.message === 'Async error');
    }
    
    console.log("Promise rejection was caught:", asyncErrorCaught);
    
    return true;
  } catch (error) {
    console.error("Error handling test failed:", error.message);
    return false;
  }
}

async function runTests() {
  console.log("=== Starting REPL Test Suite ===");
  
  const tests = [
    { name: "Basic JavaScript", fn: testBasicJS },
    { name: "Promises and async/await", fn: testPromises },
    { name: "Global objects and functions", fn: testGlobals },
    { name: "Dynamic imports", fn: testImports },
    { name: "Fetch API", fn: testFetch },
    { name: "URL utilities", fn: testUrlUtils },
    { name: "Filesystem access", fn: testFileSystem },
    { name: "Environment variables", fn: testEnvironmentVars },
    { name: "Supabase helper", fn: testSupabaseHelper },
    { name: "Error handling", fn: testErrorHandling }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n--- Running test: ${test.name} ---`);
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
      console.log(`--- Test ${success ? "PASSED" : "FAILED"}: ${test.name} ---`);
    } catch (error) {
      console.error(`Unexpected error in test ${test.name}:`, error);
      results.push({ name: test.name, success: false, error });
      console.log(`--- Test FAILED: ${test.name} ---`);
    }
  }
  
  console.log("\n=== Test Results Summary ===");
  for (const result of results) {
    console.log(`${result.success ? "✓" : "✗"} ${result.name}`);
  }
  
  const allPassed = results.every(r => r.success);
  console.log(`\n${allPassed ? "All tests passed!" : "Some tests failed!"}`);
  
  return {
    allPassed,
    results
  };
}

// Execute all tests
return runTests(); 