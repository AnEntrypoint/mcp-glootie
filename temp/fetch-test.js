// Fetch API Testing
// This script tests the custom fetch implementation in the REPL environment

// Test basic fetching capabilities
async function testBasicFetch() {
  console.log("=== Testing Basic Fetch ===");
  
  try {
    // Test GET request
    const response = await fetch('https://httpbin.org/get?param=value');
    const data = await response.json();
    
    console.log("GET Status:", response.status);
    console.log("GET OK:", response.ok);
    console.log("Got data:", !!data);
    console.log("Query param received:", data.args.param === 'value');
    
    // Test headers
    console.log("Response has headers:", typeof response.headers === 'object');
    
    // Test response methods
    console.log("Response URL:", response.url);
    
    return true;
  } catch (error) {
    console.error("Basic fetch test failed:", error);
    return false;
  }
}

// Test request methods and body handling
async function testRequestMethods() {
  console.log("\n=== Testing Request Methods ===");
  
  try {
    // Test POST with JSON body
    const postResponse = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world', number: 42 })
    });
    
    const postData = await postResponse.json();
    console.log("POST Status:", postResponse.status);
    console.log("Content-Type header sent:", 
      postData.headers['Content-Type'] === 'application/json');
    console.log("JSON data received correctly:", 
      postData.json && postData.json.hello === 'world' && postData.json.number === 42);
    
    // Test PUT method
    const putResponse = await fetch('https://httpbin.org/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'put' })
    });
    
    const putData = await putResponse.json();
    console.log("PUT works:", putResponse.status === 200 && putData.json.method === 'put');
    
    // Test DELETE method
    const deleteResponse = await fetch('https://httpbin.org/delete', {
      method: 'DELETE'
    });
    
    console.log("DELETE works:", deleteResponse.status === 200);
    
    return true;
  } catch (error) {
    console.error("Request methods test failed:", error);
    return false;
  }
}

// Test response handling formats
async function testResponseFormats() {
  console.log("\n=== Testing Response Formats ===");
  
  try {
    // Test text response
    const textResponse = await fetch('https://httpbin.org/html');
    const text = await textResponse.text();
    console.log("Text response works:", text.includes('<!DOCTYPE html>'));
    
    // Test JSON response
    const jsonResponse = await fetch('https://httpbin.org/json');
    const json = await jsonResponse.json();
    console.log("JSON response works:", json.slideshow && json.slideshow.title === 'Sample Slide Show');
    
    // Test binary response handling
    const binaryResponse = await fetch('https://httpbin.org/image/png');
    const buffer = await binaryResponse.buffer();
    console.log("Binary response works:", buffer instanceof Buffer);
    console.log("Buffer length:", buffer.length > 0);
    
    return true;
  } catch (error) {
    console.error("Response formats test failed:", error);
    return false;
  }
}

// Test error handling
async function testErrorHandling() {
  console.log("\n=== Testing Error Handling ===");
  
  try {
    // Test 404 response
    try {
      const notFoundResponse = await fetch('https://httpbin.org/status/404');
      console.log("404 creates response with ok=false:", notFoundResponse.ok === false);
      console.log("404 status code:", notFoundResponse.status === 404);
    } catch (error) {
      console.error("Fetch should not throw on 404:", error);
      return false;
    }
    
    // Test connection errors (invalid domain)
    try {
      await fetch('https://this-domain-does-not-exist-for-sure-12345.com');
      console.log("Should not reach here");
      return false;
    } catch (error) {
      console.log("Invalid domain error caught successfully");
    }
    
    // Test timeout handling with explicit timeout
    try {
      await fetch('https://httpbin.org/delay/5', { timeout: 1000 });
      console.log("Should not reach here");
      return false;
    } catch (error) {
      console.log("Timeout error caught successfully");
    }
    
    return true;
  } catch (error) {
    console.error("Error handling test failed:", error);
    return false;
  }
}

// Test URL normalization
async function testUrlNormalization() {
  console.log("\n=== Testing URL Normalization ===");
  
  try {
    // Test URL without protocol
    const response1 = await fetch('httpbin.org/get');
    console.log("URL without protocol works:", response1.status === 200);
    
    // Test with path only URL
    try {
      await fetch('/path/only');
      console.log("Should not reach here");
      return false;
    } catch (error) {
      console.log("Path-only URL rejected as expected");
    }
    
    // Test with relative URL (should fail)
    try {
      await fetch('./relative');
      console.log("Should not reach here");
      return false;
    } catch (error) {
      console.log("Relative URL rejected as expected");
    }
    
    return true;
  } catch (error) {
    console.error("URL normalization test failed:", error);
    return false;
  }
}

// Run all tests
async function runFetchTests() {
  console.log("======= FETCH API TEST SUITE =======");
  console.log("Testing the fetch implementation...");
  
  const tests = [
    { name: "Basic Fetch", fn: testBasicFetch },
    { name: "Request Methods", fn: testRequestMethods },
    { name: "Response Formats", fn: testResponseFormats },
    { name: "Error Handling", fn: testErrorHandling },
    { name: "URL Normalization", fn: testUrlNormalization }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
    } catch (error) {
      console.error(`Test "${test.name}" failed with error:`, error);
      results.push({ name: test.name, success: false, error });
    }
  }
  
  // Print summary
  console.log("\n======= TEST RESULTS =======");
  for (const result of results) {
    console.log(`${result.success ? '✓' : '✗'} ${result.name}`);
  }
  
  const allPassed = results.every(r => r.success);
  console.log(`\n${allPassed ? 'All tests passed!' : 'Some tests failed!'}`);
  
  return {
    allPassed,
    results
  };
}

// Execute all tests
return runFetchTests(); 