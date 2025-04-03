/**
 * Tests for network operations to verify they don't get cut short
 */

export default [
  {
    name: "HTTP request with await",
    code: `
      async function makeRequest() {
        console.log('Starting HTTP request');
        // Using setTimeout to simulate network latency
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Network request completed');
        return 'Request completed successfully';
      }
      
      return await makeRequest();
    `,
    expected: "Request completed successfully",
    timeout: 2000, // Higher timeout for this test
  },
  {
    name: "Multiple sequential network requests",
    code: `
      async function makeRequests() {
        console.log('Starting first request');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('First request completed');
        
        console.log('Starting second request');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Second request completed');
        
        return 'All requests completed';
      }
      
      return await makeRequests();
    `,
    expected: "All requests completed",
    timeout: 2000, // Higher timeout for this test
  },
  {
    name: "Parallel network requests with Promise.all",
    code: `
      async function parallelRequests() {
        console.log('Starting parallel requests');
        
        const results = await Promise.all([
          new Promise(resolve => setTimeout(() => resolve('Request 1 done'), 800)),
          new Promise(resolve => setTimeout(() => resolve('Request 2 done'), 600))
        ]);
        
        console.log('All parallel requests completed');
        return results.join(', ');
      }
      
      return await parallelRequests();
    `,
    expected: ({ returnValue }) => {
      return typeof returnValue === 'string' && 
             returnValue.includes('Request 1 done') && 
             returnValue.includes('Request 2 done');
    },
    timeout: 2000
  },
  {
    name: "Long running operation with progress updates",
    code: `
      async function longRunningTask() {
        console.log('Starting long task');
        
        for (let i = 1; i <= 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 300));
          console.log(\`Progress: \${i}/3\`);
        }
        
        console.log('Long task completed');
        return 'Long running task finished';
      }
      
      return await longRunningTask();
    `,
    expected: "Long running task finished",
    timeout: 2000
  },
  {
    name: "Network request with error handling",
    code: `
      async function requestWithError() {
        try {
          console.log('Starting request that will fail');
          await new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Network error')), 500)
          );
          return 'This should not happen';
        } catch (error) {
          console.log('Caught network error:', error.message);
          return 'Error handled: ' + error.message;
        }
      }
      
      return await requestWithError();
    `,
    expected: "Error handled: Network error",
    timeout: 2000
  },
  {
    name: "Simulated API call with JSON response",
    code: `
      async function mockApiCall() {
        console.log('Starting mock API call');
        
        // Simulate API call with delay
        const mockResponse = await new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              data: { message: "Hello from API", count: 42 }
            });
          }, 700);
        });
        
        console.log('API response received');
        return JSON.stringify(mockResponse.data);
      }
      
      return await mockApiCall();
    `,
    expected: ({ returnValue }) => {
      try {
        const parsed = JSON.parse(returnValue);
        return parsed.message === "Hello from API" && parsed.count === 42;
      } catch (e) {
        return false;
      }
    },
    timeout: 2000
  }
]; 