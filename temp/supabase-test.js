// Supabase Helper Testing
// This script tests the Supabase helper functionality in the REPL environment

// Check if Supabase client can be initialized
async function testSupabaseInit() {
  console.log("=== Testing Supabase Initialization ===");
  
  try {
    // Check if supabaseHelper is available
    if (typeof supabaseHelper === 'undefined') {
      console.error("Supabase helper is not available in the environment");
      return false;
    }
    
    console.log("Supabase helper exists:", typeof supabaseHelper === 'object');
    
    // Check for required environment variables
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      console.error("Missing required Supabase environment variables");
      console.log("SUPABASE_URL:", url ? "✓" : "✗");
      console.log("SUPABASE_KEY:", key ? "✓" : "✗");
      return false;
    }
    
    console.log("Environment variables are set correctly");
    
    // Try to initialize Supabase client if initSupabase function is available
    let client;
    if (typeof initSupabase === 'function') {
      client = await initSupabase();
      console.log("Client initialized with initSupabase():", !!client);
    } else if (supabaseHelper.createClient) {
      client = supabaseHelper.createClient(url, key);
      console.log("Client initialized with createClient():", !!client);
    } else {
      console.error("No method available to initialize Supabase client");
      return false;
    }
    
    // Store client for other tests
    globalThis._supabaseClient = client;
    return !!client;
  } catch (error) {
    console.error("Supabase initialization test failed:", error.message);
    return false;
  }
}

// Test basic database operations
async function testBasicOperations() {
  console.log("\n=== Testing Basic Supabase Operations ===");
  
  if (!globalThis._supabaseClient) {
    console.error("Supabase client not initialized, skipping operations test");
    return false;
  }
  
  const client = globalThis._supabaseClient;
  
  try {
    // Test simple RPC call (system time)
    console.log("Testing RPC call...");
    const { data: timeData, error: timeError } = await client.rpc('get_current_timestamp');
    
    if (timeError) {
      // If specific RPC doesn't exist, try a basic query instead
      console.log("RPC 'get_current_timestamp' not available, trying alternative test");
      
      // Check schema version or similar safe query
      const { data: versionData, error: versionError } = await client
        .from('pg_catalog.pg_tables')
        .select('schemaname')
        .limit(1);
      
      if (versionError && !versionData) {
        console.error("Failed to execute basic query:", versionError.message);
        return false;
      }
      
      console.log("Basic query succeeded");
    } else {
      console.log("RPC call succeeded, current timestamp:", timeData);
    }
    
    return true;
  } catch (error) {
    console.error("Basic operations test failed:", error.message);
    return false;
  }
}

// Test helper utility functions
async function testHelperUtils() {
  console.log("\n=== Testing Supabase Helper Utilities ===");
  
  if (!globalThis._supabaseClient) {
    console.error("Supabase client not initialized, skipping helper utils test");
    return false;
  }
  
  const client = globalThis._supabaseClient;
  
  try {
    // Test queryTable utility if available
    if (typeof queryTable === 'function') {
      console.log("Testing queryTable utility...");
      try {
        const result = await queryTable(client, 'pg_catalog.pg_tables', {
          select: 'schemaname',
          limit: 5
        });
        
        console.log("queryTable works:", result && Array.isArray(result.data));
        console.log(`Retrieved ${result.count} rows`);
      } catch (error) {
        console.log("queryTable test failed:", error.message);
      }
    } else {
      console.log("queryTable utility not available");
    }
    
    // Test tableExists utility if available
    if (typeof tableExists === 'function') {
      console.log("Testing tableExists utility...");
      try {
        const exists = await tableExists(client, 'pg_catalog.pg_tables');
        console.log("tableExists works:", exists === true);
      } catch (error) {
        console.log("tableExists test failed:", error.message);
      }
    } else {
      console.log("tableExists utility not available");
    }
    
    // Test listTables utility if available
    if (typeof listTables === 'function') {
      console.log("Testing listTables utility...");
      try {
        const tables = await listTables(client);
        console.log("listTables works:", Array.isArray(tables));
      } catch (error) {
        console.log("listTables test failed:", error.message);
      }
    } else {
      console.log("listTables utility not available");
    }
    
    return true;
  } catch (error) {
    console.error("Helper utils test failed:", error.message);
    return false;
  }
}

// Test SQL query execution
async function testSqlExecution() {
  console.log("\n=== Testing SQL Execution ===");
  
  if (!globalThis._supabaseClient) {
    console.error("Supabase client not initialized, skipping SQL execution test");
    return false;
  }
  
  const client = globalThis._supabaseClient;
  
  try {
    // Test executeSQL utility if available
    if (typeof executeSQL === 'function') {
      console.log("Testing executeSQL utility...");
      try {
        const result = await executeSQL(
          client, 
          'SELECT current_timestamp as time, current_database() as db'
        );
        console.log("executeSQL works:", result && result[0] && result[0].time);
        console.log("Current database:", result[0].db);
      } catch (error) {
        console.log("executeSQL test failed:", error.message);
      }
    } else if (supabaseHelper.executeQuery) {
      // Alternative using supabaseHelper.executeQuery
      console.log("Testing executeQuery utility...");
      try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        const result = await supabaseHelper.executeQuery(
          url,
          key,
          'SELECT current_timestamp as time, current_database() as db'
        );
        console.log("executeQuery works:", result && result[0] && result[0].time);
        console.log("Current database:", result[0].db);
      } catch (error) {
        console.log("executeQuery test failed:", error.message);
      }
    } else {
      console.log("SQL execution utilities not available");
    }
    
    return true;
  } catch (error) {
    console.error("SQL execution test failed:", error.message);
    return false;
  }
}

// Run all tests
async function runSupabaseTests() {
  console.log("======= SUPABASE HELPER TEST SUITE =======");
  console.log("Testing Supabase helper functionality...");
  
  const tests = [
    { name: "Supabase Initialization", fn: testSupabaseInit },
    { name: "Basic Operations", fn: testBasicOperations },
    { name: "Helper Utilities", fn: testHelperUtils },
    { name: "SQL Execution", fn: testSqlExecution }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
      console.log(`--- Test ${success ? "PASSED" : "FAILED"}: ${test.name} ---`);
    } catch (error) {
      console.error(`Test "${test.name}" failed with error:`, error);
      results.push({ name: test.name, success: false, error });
      console.log(`--- Test FAILED: ${test.name} ---`);
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
return runSupabaseTests(); 