/**
 * Supabase Helper Test Script
 * 
 * This script tests the Supabase helper to ensure it can properly connect 
 * to Supabase and perform basic operations including using the wrappedsupabase function.
 */

// Load environment variables
console.log('Loading environment variables...');
console.log('SUPABASE_URL:', env.SUPABASE_URL);
console.log('Service Role Key available:', env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No');

// Test 1: Basic fetch with timeout
async function testBasicFetch() {
  console.log('\n--- Testing Basic Fetch ---');
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
    const data = await response.json();
    console.log('✅ Basic fetch successful:', data.title);
    return true;
  } catch (error) {
    console.error('❌ Basic fetch failed:', error.message);
    return false;
  }
}

// Test 2: Direct Supabase API request
async function testDirectSupabaseRequest() {
  console.log('\n--- Testing Direct Supabase API Request ---');
  try {
    // Setup headers
    const headers = {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    };
    
    // Create an AbortController to handle timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Make the request
    const url = `${env.SUPABASE_URL}/rest/v1/postgres_tables?limit=1`;
    console.log(`Making request to ${url}...`);
    
    const response = await fetch(url, {
      method: 'GET', 
      headers,
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Direct Supabase request successful:', Array.isArray(data) ? `${data.length} items returned` : 'Data received');
    return true;
  } catch (error) {
    console.error('❌ Direct Supabase request failed:', error.message);
    return false;
  }
}

// Test 3: WrappedSupabase Function
async function testWrappedSupabaseFunction() {
  console.log('\n--- Testing WrappedSupabase Function ---');
  try {
    // Setup headers
    const headers = {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    };
    
    // Create an AbortController to handle timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    // Make the request to the function
    const url = `${env.SUPABASE_URL}/functions/v1/wrappedsupabase`;
    const body = {
      path: ['sql'],
      params: {
        sql: 'SELECT version();'
      }
    };
    
    console.log(`Making request to ${url}...`);
    console.log('Request body:', JSON.stringify(body));
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ WrappedSupabase function call successful:');
    console.log(JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ WrappedSupabase function call failed:', error.message);
    return false;
  }
}

// Test 4: Using the Supabase Helper
async function testSupabaseHelper() {
  console.log('\n--- Testing Supabase Helper ---');
  try {
    // Try to load the helper
    const { createSupabaseClient } = require('./supabase-helper');
    console.log('✅ Supabase helper loaded successfully');
    
    // Create a client instance
    const supabase = createSupabaseClient();
    console.log('✅ Supabase client created successfully');
    
    // Test the wrapped SQL function
    console.log('Testing wrapped SQL function...');
    const sqlResult = await supabase.functions.wrapped.sql('SELECT version();');
    console.log('SQL Result:', JSON.stringify(sqlResult, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Supabase helper test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  try {
    const results = {
      basicFetch: await testBasicFetch(),
      directSupabase: await testDirectSupabaseRequest(),
      wrappedSupabase: await testWrappedSupabaseFunction(),
      supabaseHelper: await testSupabaseHelper()
    };
    
    console.log('\n--- Test Results Summary ---');
    for (const [test, passed] of Object.entries(results)) {
      console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    }
    
    const overallSuccess = Object.values(results).every(r => r);
    console.log(`\nOverall: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return overallSuccess;
  } catch (error) {
    console.error('Error running tests:', error);
    return false;
  }
}

// Run the tests
runTests(); 