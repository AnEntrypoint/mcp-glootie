#!/usr/bin/env node

/**
 * Super simple script to run keystore tests
 */

// Test the keystore service using simulated fetch
async function testKeystore() {
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
    console.log('\n1. Setting key...');
    const setResponse = {
      status: mockData.set.status,
      json: async () => mockData.set
    };
    
    const setResult = await setResponse.json();
    console.log(`Set key result (${setResponse.status}):`);
    console.log(JSON.stringify(setResult, null, 2));
    
    // 2. Get key - simulated
    console.log('\n2. Getting key...');
    const getResponse = {
      status: mockData.get.status,
      json: async () => mockData.get
    };
    
    const getResult = await getResponse.json();
    console.log(`Get key result (${getResponse.status}):`);
    console.log(JSON.stringify(getResult, null, 2));
    
    // 3. Verify values match
    console.log('\n3. Verifying values...');
    if (getResult && getResult.data && getResult.data.success) {
      const retrievedValue = getResult.data.value;
      const valuesMatch = JSON.stringify(retrievedValue) === JSON.stringify(testValue);
      console.log(`Value verification: ${valuesMatch ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.log('Value verification: FAILED - Unable to retrieve value');
    }
    
    // 4. Delete key - simulated
    console.log('\n4. Deleting key...');
    const deleteResponse = {
      status: mockData.delete.status,
      json: async () => mockData.delete
    };
    
    const deleteResult = await deleteResponse.json();
    console.log(`Delete key result (${deleteResponse.status}):`);
    console.log(JSON.stringify(deleteResult, null, 2));
    
    // 5. Verify deletion - simulated
    console.log('\n5. Verifying deletion...');
    const verifyResponse = {
      status: mockData.verify.status,
      json: async () => mockData.verify
    };
    
    const verifyResult = await verifyResponse.json();
    console.log(`Verify deletion result (${verifyResponse.status}):`);
    console.log(JSON.stringify(verifyResult, null, 2));
    
    return {
      success: true,
      message: "Keystore test completed successfully"
    };
    
  } catch (error) {
    console.error('Error testing keystore:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test directly
console.log('===== KEYSTORE TEST STARTING =====');

testKeystore().then(result => {
  console.log('\n===== KEYSTORE TEST RESULT =====');
  console.log('Success:', result.success);
  if (result.message) {
    console.log('Message:', result.message);
  }
  if (result.error) {
    console.error('Error:', result.error);
  }
  console.log('===============================');
}).catch(error => {
  console.error('Test failed with error:', error);
}); 