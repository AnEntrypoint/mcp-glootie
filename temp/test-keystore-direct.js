// Simple keystore test that logs directly
console.log('===== KEYSTORE TEST STARTED =====');

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

// Simulate mock responses for testing
const mockData = {
  set: { 
    data: { success: true, key: testKey },
    status: 200
  },
  get: { 
    data: { success: true, value: testValue },
    status: 200
  }
};

// Log the mock data
console.log('\nMocked API responses:');
console.log(JSON.stringify(mockData, null, 2));

// Test complete
console.log('\n===== KEYSTORE TEST COMPLETED ====='); 