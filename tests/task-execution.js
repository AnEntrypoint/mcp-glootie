/**
 * Tests for task execution with multiple console logs
 */

export default [
  {
    "name": "Task execution with extensive logging",
    "code": `
      // Simple test that returns a fixed value after logging
      function logManyLines() {
        console.log("Line 1 of output");
        console.log("Line 2 of output");
        console.log("Line 3 of output");
        console.log("Line 4 of output");
        console.log("Line 5 of output");
        
        const obj = {
          status: "success",
          data: [1, 2, 3, 4, 5]
        };
        
        console.log("Result object:", obj);
        return "test-success";
      }
      
      logManyLines();
      return "test-success";
    `,
    "expected": "test-success"
  }
]; 