
// Test the wrappedkeystore service using fetch
async function testKeystore() {
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nxmqazntnbzpkhmzwmue.supabase.co';
  
  // Create test keys with unique timestamps
  const timestamp = Date.now();
  const testKey = `repl-test-${timestamp}`;
  const testValue = {
    message: 'Test from MCP REPL',
    timestamp,
    nested: {
      value: 42,
      flag: true
    }
  };
  
  console.log(`Testing keystore with key: ${testKey}`);
  console.log(`Test value: ${JSON.stringify(testValue, null, 2)}`);
  
  try {
    // 1. Set key
    console.log('\n1. Setting key...');
    const setResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/wrappedkeystore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
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
    console.log(`Set key result (${setResponse.status}):`);
    console.log(JSON.stringify(setResult, null, 2));
    
    // 2. Get key
    console.log('\n2. Getting key...');
    const getResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/wrappedkeystore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
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
    console.log(`Get key result (${getResponse.status}):`);
    console.log(JSON.stringify(getResult, null, 2));
    
    // 3. Verify values match
    console.log('\n3. Verifying values...');
    if (getResult && getResult.data && getResult.data.success) {
      const retrievedValue = getResult.data.value;
      const valuesMatch = JSON.stringify(retrievedValue) === JSON.stringify(testValue);
      console.log(`Value verification: ${valuesMatch ? 'SUCCESS' : 'FAILED'}`);
      
      if (!valuesMatch) {
        console.log('Original:', JSON.stringify(testValue));
        console.log('Retrieved:', JSON.stringify(retrievedValue));
      }
    } else {
      console.log('Value verification: FAILED - Unable to retrieve value');
    }
    
    // 4. Delete key
    console.log('\n4. Deleting key...');
    const deleteResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/wrappedkeystore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
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
    console.log(`Delete key result (${deleteResponse.status}):`);
    console.log(JSON.stringify(deleteResult, null, 2));
    
    // 5. Verify deletion
    console.log('\n5. Verifying deletion...');
    const verifyResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/wrappedkeystore`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
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
    console.log(`Verify deletion result (${verifyResponse.status}):`);
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
  console.log('\n========== FINAL RESULT ==========');
  console.log(`Test successful: ${result.success}`);
  return result; // Return the result so we can see it in the REPL output
});
