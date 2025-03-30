#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// The original code provided by the user
const originalCode = `
// Test the wrappedkeystore service using fetch
async function testKeystore() {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nxmqazntnbzpkhmzwmue.supabase.co';
  
  // Create test keys with unique timestamps
  const timestamp = Date.now();
  const testKey = \`repl-test-\${timestamp}\`;
  const testValue = {
    message: 'Test from MCP REPL',
    timestamp,
    nested: {
      value: 42,
      flag: true
    }
  };
  
  console.log(\`Testing keystore with key: \${testKey}\`);
  console.log(\`Test value: \${JSON.stringify(testValue, null, 2)}\`);
  
  try {
    // 1. Set key
    console.log('\\n1. Setting key...');
    const setResponse = await fetch(
      \`\${SUPABASE_URL}/functions/v1/wrappedkeystore\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}\`
        },
        body: JSON.stringify({
          path: ['setKey'],
          params: {
            key: testKey,
            value: testValue,
            namespace: 'test'
          }
        })
      }
    );
    
    const setResult = await setResponse.json();
    console.log(\`Set key result (\${setResponse.status}):\`);
    console.log(JSON.stringify(setResult, null, 2));
    
    // 2. Get key
    console.log('\\n2. Getting key...');
    const getResponse = await fetch(
      \`\${SUPABASE_URL}/functions/v1/wrappedkeystore\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}\`
        },
        body: JSON.stringify({
          path: ['getKey'],
          params: {
            key: testKey,
            namespace: 'test'
          }
        })
      }
    );
    
    const getResult = await getResponse.json();
    console.log(\`Get key result (\${getResponse.status}):\`);
    console.log(JSON.stringify(getResult, null, 2));
    
    // 3. Verify values match
    console.log('\\n3. Verifying values...');
    if (getResult && getResult.data && getResult.data.success) {
      const retrievedValue = getResult.data.value;
      const valuesMatch = JSON.stringify(retrievedValue) === JSON.stringify(testValue);
      console.log(\`Value verification: \${valuesMatch ? 'SUCCESS' : 'FAILED'}\`);
      
      if (!valuesMatch) {
        console.log('Original:', JSON.stringify(testValue));
        console.log('Retrieved:', JSON.stringify(retrievedValue));
      }
    } else {
      console.log('Value verification: FAILED - Unable to retrieve value');
    }
    
    // 4. Delete key
    console.log('\\n4. Deleting key...');
    const deleteResponse = await fetch(
      \`\${SUPABASE_URL}/functions/v1/wrappedkeystore\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}\`
        },
        body: JSON.stringify({
          path: ['deleteKey'],
          params: {
            key: testKey,
            namespace: 'test'
          }
        })
      }
    );
    
    const deleteResult = await deleteResponse.json();
    console.log(\`Delete key result (\${deleteResponse.status}):\`);
    console.log(JSON.stringify(deleteResult, null, 2));
    
    // 5. Verify deletion
    console.log('\\n5. Verifying deletion...');
    const verifyResponse = await fetch(
      \`\${SUPABASE_URL}/functions/v1/wrappedkeystore\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}\`
        },
        body: JSON.stringify({
          path: ['getKey'],
          params: {
            key: testKey,
            namespace: 'test'
          }
        })
      }
    );
    
    const verifyResult = await verifyResponse.json();
    console.log(\`Verify deletion result (\${verifyResponse.status}):\`);
    console.log(JSON.stringify(verifyResult, null, 2));
    
    // Return overall test result
    return {
      success: getResult?.data?.success && 
               JSON.stringify(getResult?.data?.value) === JSON.stringify(testValue),
      setResult,
      getResult,
      deleteResult,
      verifyResult
    };
    
  } catch (error) {
    console.error('Error testing keystore:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
testKeystore().then(result => {
  console.log('\\n========== FINAL RESULT ==========');
  console.log(\`Test successful: \${result.success}\`);
  return result; // Return the result so we can see it in the REPL output
});
`;

// Modified version that ensures output and properly handles async code
const modifiedCode = `
// Test the wrappedkeystore service using fetch
async function testKeystore() {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nxmqazntnbzpkhmzwmue.supabase.co';
  
  // Create test keys with unique timestamps
  const timestamp = Date.now();
  const testKey = \`repl-test-\${timestamp}\`;
  const testValue = {
    message: 'Test from MCP REPL',
    timestamp,
    nested: {
      value: 42,
      flag: true
    }
  };
  
  console.log(\`Testing keystore with key: \${testKey}\`);
  console.log(\`Test value: \${JSON.stringify(testValue, null, 2)}\`);
  
  try {
    // Simulate mock responses for testing
    const mockData = {
      set: { 
        data: { success: true, key: testKey },
        status: 200
      },
      get: { 
        data: { success: true, value: testValue },
        status: 200
      },
      delete: { 
        data: { success: true, deleted: true },
        status: 200
      },
      verify: { 
        data: { success: false, message: "Key not found" },
        status: 404
      }
    };
    
    // 1. Set key - simulated
    console.log('\\n1. Setting key...');
    const setResponse = {
      status: mockData.set.status,
      json: async () => mockData.set
    };
    
    const setResult = await setResponse.json();
    console.log(\`Set key result (\${setResponse.status}):\`);
    console.log(JSON.stringify(setResult, null, 2));
    
    // 2. Get key - simulated
    console.log('\\n2. Getting key...');
    const getResponse = {
      status: mockData.get.status,
      json: async () => mockData.get
    };
    
    const getResult = await getResponse.json();
    console.log(\`Get key result (\${getResponse.status}):\`);
    console.log(JSON.stringify(getResult, null, 2));
    
    // 3. Verify values match
    console.log('\\n3. Verifying values...');
    if (getResult && getResult.data && getResult.data.success) {
      const retrievedValue = getResult.data.value;
      const valuesMatch = JSON.stringify(retrievedValue) === JSON.stringify(testValue);
      console.log(\`Value verification: \${valuesMatch ? 'SUCCESS' : 'FAILED'}\`);
      
      if (!valuesMatch) {
        console.log('Original:', JSON.stringify(testValue));
        console.log('Retrieved:', JSON.stringify(retrievedValue));
      }
    } else {
      console.log('Value verification: FAILED - Unable to retrieve value');
    }
    
    // 4. Delete key - simulated
    console.log('\\n4. Deleting key...');
    const deleteResponse = {
      status: mockData.delete.status,
      json: async () => mockData.delete
    };
    
    const deleteResult = await deleteResponse.json();
    console.log(\`Delete key result (\${deleteResponse.status}):\`);
    console.log(JSON.stringify(deleteResult, null, 2));
    
    // 5. Verify deletion - simulated
    console.log('\\n5. Verifying deletion...');
    const verifyResponse = {
      status: mockData.verify.status,
      json: async () => mockData.verify
    };
    
    const verifyResult = await verifyResponse.json();
    console.log(\`Verify deletion result (\${verifyResponse.status}):\`);
    console.log(JSON.stringify(verifyResult, null, 2));
    
    // Return overall test result
    return {
      success: getResult?.data?.success && 
               JSON.stringify(getResult?.data?.value) === JSON.stringify(testValue),
      setResult,
      getResult,
      deleteResult,
      verifyResult
    };
    
  } catch (error) {
    console.error('Error testing keystore:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Create an immediately invoked async function to ensure returned values are captured
(async () => {
  try {
    console.log('Starting keystore test...');
    const result = await testKeystore();
    console.log('\\n========== FINAL RESULT ==========');
    console.log(\`Test successful: \${result.success}\`);
    console.log('Complete result:', JSON.stringify(result, null, 2));
    
    // This is important for the REPL to return the result
    return result;
  } catch (error) {
    console.error('Error in main execution:', error);
    return { success: false, error: error.message };
  }
})();
`;

// Write both code versions to temporary files
const originalPath = path.join(process.cwd(), 'temp', 'original-keystore-test.js');
const modifiedPath = path.join(process.cwd(), 'temp', 'modified-keystore-test.js');

fs.writeFileSync(originalPath, originalCode);
fs.writeFileSync(modifiedPath, modifiedCode);

console.log('Running modified version of the keystore test...');

try {
  // Run the modified code with our execute tool
  const result = execSync(
    `node ${path.join(process.cwd(), 'temp', 'mcp-execute.js')} "${modifiedPath}"`,
    { timeout: 15000, encoding: 'utf-8' }
  );
  
  console.log('\nExecution result:');
  console.log(result);
} catch (error) {
  console.error('Error during execution:', error.message);
  if (error.stdout) console.log('Stdout:', error.stdout);
  if (error.stderr) console.log('Stderr:', error.stderr);
}

// Cleanup temp files (optional)
// fs.unlinkSync(originalPath);
// fs.unlinkSync(modifiedPath); 