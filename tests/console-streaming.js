/**
 * Tests for console output streaming and large log handling
 */

export default [
  {
    "name": "Multiple console logs in async function",
    "code": `
      async function logManyMessages() {
        console.log('Start of test');
        for (let i = 1; i <= 20; i++) {
          console.log(\`Message \${i} of 20\`);
          // Small delay to simulate processing
          await new Promise(r => setTimeout(r, 10));
        }
        console.log('End of test');
        return 'Completed';
      }
      
      return await logManyMessages();
    `,
    "expected": "Completed"
  },
  {
    "name": "Large console output in async operations",
    "code": `
      const results = [];
      
      async function simulateOperation(id, delay) {
        console.log(\`Operation \${id} starting\`);
        await new Promise(r => setTimeout(r, delay));
        console.log(\`Operation \${id} completed after \${delay}ms\`);
        return { id, status: 'success', delay };
      }
      
      async function runParallelOperations() {
        console.log('Starting parallel operations test');
        const operations = [];
        
        for (let i = 1; i <= 10; i++) {
          operations.push(simulateOperation(i, 50 + Math.floor(Math.random() * 100)));
        }
        
        console.log(\`Waiting for \${operations.length} operations to complete...\`);
        const results = await Promise.all(operations);
        
        console.log('All operations completed:');
        results.forEach(result => {
          console.log(\`- Operation \${result.id}: \${result.status} (\${result.delay}ms)\`);
        });
        
        return results.length;
      }
      
      return await runParallelOperations();
    `,
    "expected": 10
  },
  {
    "name": "Complex async fetch with console logs",
    "code": `
      const fetchWithTimeout = async (url, options = {}, timeoutMs = 500) => {
        console.log(\`Fetching \${url} with timeout \${timeoutMs}ms\`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('Request timed out, aborting');
          controller.abort();
        }, timeoutMs);
        
        try {
          console.log('Starting fetch request');
          // This will throw since we're using a non-existent URL
          const response = await fetch('https://non-existent-url-for-testing-only.xyz', {
            ...options,
            signal: controller.signal
          });
          console.log('Fetch completed with status:', response.status);
          return response;
        } catch (error) {
          console.log('Fetch error occurred:', error.name);
          console.error('Error details:', error.message);
          throw error;
        } finally {
          console.log('Cleanup: clearing timeout');
          clearTimeout(timeoutId);
        }
      };
      
      async function testFetchOperation() {
        console.log('Starting fetch test');
        try {
          const result = await fetchWithTimeout();
          console.log('Success:', result);
          return 'success';
        } catch (error) {
          console.log('Test caught error:', error.name);
          console.log('Test completed with expected failure');
          return 'expected-failure';
        }
      }
      
      return await testFetchOperation();
    `,
    "expected": "expected-failure"
  }
]; 