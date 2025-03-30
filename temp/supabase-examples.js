/**
 * Supabase Helper Examples
 * 
 * This file contains practical examples of using the Supabase helper in the REPL.
 */

// First, let's check if we have the required environment variables
console.log('SUPABASE_URL:', env.SUPABASE_URL);
console.log('Service Role Key available:', env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No');

// Setup the Supabase client - in REPL you can use:
// const { createSupabaseClient } = require('./temp/supabase-helper');
// In this example file we'll simulate this:
let supabase;

// Example 1: Create a Supabase client and get server version
async function example1_basicConnection() {
  console.log('\n--- Example 1: Basic Connection ---');
  
  try {
    // Create a client (or use the pre-created one from the module)
    supabase = createSupabaseClient();
    
    // Test a simple SQL query using the wrappedsupabase function
    const result = await supabase.functions.wrapped.sql('SELECT version();');
    console.log('PostgreSQL Version:', result.data?.[0]?.version || 'Unknown');
    return true;
  } catch (error) {
    console.error('Error in example 1:', error.message);
    return false;
  }
}

// Example 2: Query data from a table using the db API
async function example2_queryData() {
  console.log('\n--- Example 2: Query Data ---');
  
  try {
    // Fetch a list of all tables in the public schema
    const result = await supabase.db.select('postgres_tables', {
      columns: 'table_name,table_schema',
      filter: {
        table_schema: 'public'
      },
      limit: 10
    });
    
    console.log('Tables in public schema:');
    result.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
    return true;
  } catch (error) {
    console.error('Error in example 2:', error.message);
    return false;
  }
}

// Example 3: Using the Edge Functions API
async function example3_edgeFunctions() {
  console.log('\n--- Example 3: Edge Functions ---');
  
  try {
    // Call the wrappedsupabase edge function with SQL
    const result = await supabase.functions.invoke('wrappedsupabase', {
      path: ['sql'],
      params: {
        sql: 'SELECT current_database();'
      }
    });
    
    console.log('Current database:', result.data?.[0]?.current_database || 'Unknown');
    return true;
  } catch (error) {
    console.error('Error in example 3:', error.message);
    return false;
  }
}

// Example 4: Handle error cases properly
async function example4_errorHandling() {
  console.log('\n--- Example 4: Error Handling ---');
  
  try {
    // Attempt to query a non-existent table
    console.log('Attempting to query a non-existent table...');
    await supabase.db.select('this_table_doesnt_exist');
    
    // This line shouldn't be reached
    console.log('This should not be reached!');
    return false;
  } catch (error) {
    // We expect an error here, so this is actually successful
    console.log('Successfully caught the expected error:', error.message);
    return true;
  }
}

// Example 5: Use the wrapped API for table operations
async function example5_wrappedTableApi() {
  console.log('\n--- Example 5: Wrapped Table API ---');
  
  try {
    // Use the wrapped.from method to query a table
    const result = await supabase.functions.wrapped.from('pg_tables', {
      select: 'schemaname,tablename',
      filter: {
        schemaname: 'public'
      },
      limit: 5
    });
    
    console.log('Tables via wrapped API:');
    result.data.forEach(table => {
      console.log(`- ${table.tablename} (schema: ${table.schemaname})`);
    });
    
    return true;
  } catch (error) {
    console.error('Error in example 5:', error.message);
    return false;
  }
}

// Run all examples
async function runExamples() {
  try {
    const results = {
      basicConnection: await example1_basicConnection(),
      queryData: await example2_queryData(),
      edgeFunctions: await example3_edgeFunctions(),
      errorHandling: await example4_errorHandling(),
      wrappedTableApi: await example5_wrappedTableApi()
    };
    
    console.log('\n--- Examples Results Summary ---');
    for (const [example, passed] of Object.entries(results)) {
      console.log(`${passed ? '✅' : '❌'} ${example}: ${passed ? 'PASSED' : 'FAILED'}`);
    }
    
    const overallSuccess = Object.values(results).every(r => r);
    console.log(`\nOverall: ${overallSuccess ? '✅ ALL EXAMPLES WORKED' : '❌ SOME EXAMPLES FAILED'}`);
    
    console.log('\n--- How to use in REPL ---');
    console.log(`
In the REPL, you can use the Supabase helper like this:

1. First, load the helper:
   const { supabase } = require('./temp/supabase-helper');

2. Then make requests:
   const result = await supabase.functions.wrapped.sql('SELECT version();');
   console.log(result);

3. For table operations:
   const users = await supabase.db.select('users', { limit: 10 });
   console.log(users);
`);
    
    return overallSuccess;
  } catch (error) {
    console.error('Error running examples:', error);
    return false;
  }
}

// In REPL this would be the code a user runs
module.exports = {
  run: runExamples,
  examples: {
    basicConnection: example1_basicConnection,
    queryData: example2_queryData,
    edgeFunctions: example3_edgeFunctions,
    errorHandling: example4_errorHandling,
    wrappedTableApi: example5_wrappedTableApi
  }
}; 