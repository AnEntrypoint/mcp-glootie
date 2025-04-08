// Tests for extended fetch operations that ensure proper completion
// These tests focus on longer-running network requests that might 
// be cut off prematurely in earlier implementations

export default [
  {
    name: "Concurrent fetch operations with Promise.all",
    code: `
      console.log("Starting concurrent fetch operations with Promise.all...");
      
      // Create an array of fetch promises
      const promises = [
        fetch('https://httpbin.org/get?id=1').then(r => r.json()),
        fetch('https://httpbin.org/get?id=2').then(r => r.json()),
        fetch('https://httpbin.org/get?id=3').then(r => r.json())
      ];
      
      console.log("Waiting for all requests to complete...");
      const results = await Promise.all(promises);
      
      const ids = results.map(result => result.args.id);
      console.log("All concurrent requests completed:", ids);
      
      return {
        ids,
        completed: ids.length === 3
      };
    `,
    timeout: 8000,
    expected: ({ returnValue, logs }) => {
      // Check if all requests completed log is present
      const allCompleted = logs.some(log => log.includes('All concurrent requests completed:'));
      
      if (allCompleted) {
        return true;
      }
      
      // Check return value as fallback
      if (typeof returnValue === 'object' && returnValue !== null) {
        if (returnValue.completed === true && Array.isArray(returnValue.ids)) {
          return returnValue.ids.length === 3;
        }
      }
      
      return false;
    }
  },
  {
    name: "Large response handling",
    code: `
      console.log("Fetching large response...");
      
      // This returns 1000 TODO items
      const response = await fetch('https://jsonplaceholder.typicode.com/todos');
      const data = await response.json();
      
      console.log(\`Received \${data.length} items\`);
      console.log("Sample items:", JSON.stringify(data.slice(0, 3)));
      
      return {
        length: data.length,
        completed: data.length > 0
      };
    `,
    timeout: 8000,
    expected: ({ returnValue, logs }) => {
      // Check if we received the expected number of items
      for (const log of logs) {
        if (log.includes('Received') && log.includes('items')) {
          const match = log.match(/Received (\d+) items/);
          if (match && parseInt(match[1]) > 100) {
            return true;
          }
        }
      }
      
      // Check if we at least have sample items log
      const hasSampleItems = logs.some(log => log.includes('Sample items:'));
      
      if (hasSampleItems) {
        return true;
      }
      
      // Check return value as fallback
      if (typeof returnValue === 'object' && returnValue !== null) {
        return returnValue.completed === true && returnValue.length > 100;
      }
      
      return false;
    }
  },
  {
    name: "Supabase-like long-running task simulation",
    code: `
      // Simulate a Supabase tasks-like operation
      console.log("Starting Supabase-like task simulation...");
      
      // Function to simulate a task
      async function simulateTask() {
        // First make a POST request
        console.log("Sending task initialization request...");
        const initResponse = await fetch('https://httpbin.org/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            task: 'simulation',
            params: { delay: 2 }
          })
        });
        
        const initData = await initResponse.json();
        console.log("Task initialized, data:", initData.json?.task);
        
        // Now fetch the result with delay (simulating waiting for task completion)
        console.log("Fetching task result...");
        const resultResponse = await fetch('https://httpbin.org/delay/2', {
          headers: {
            'Authorization': 'Bearer test-token'
          }
        });
        
        const resultData = await resultResponse.json();
        console.log("Task result received after delay");
        
        return {
          initialized: true,
          completed: true,
          result: resultData
        };
      }
      
      const result = await simulateTask();
      console.log("Full task execution completed");
      
      return result;
    `,
    timeout: 10000,
    expected: ({ returnValue, logs }) => {
      // Check for all the expected log messages
      const hasInit = logs.some(log => log.includes('Sending task initialization request'));
      const hasInitCompleted = logs.some(log => log.includes('Task initialized'));
      const hasFetchResult = logs.some(log => log.includes('Fetching task result'));
      const hasResultReceived = logs.some(log => log.includes('Task result received after delay'));
      const hasFullCompletion = logs.some(log => log.includes('Full task execution completed'));
      
      if (hasInit && hasInitCompleted && hasFetchResult && hasResultReceived && hasFullCompletion) {
        return true;
      }
      
      // Check return value as fallback
      if (typeof returnValue === 'object' && returnValue !== null) {
        return returnValue.initialized === true && returnValue.completed === true;
      }
      
      return false;
    }
  }
]; 