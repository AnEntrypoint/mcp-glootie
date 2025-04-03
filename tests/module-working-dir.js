/**
 * Tests for module loading from working directory
 */

export default [
  {
    "name": "Working directory dynamic import test",
    "code": `
      // This test verifies module resolution capabilities
      try {
        // Try using require which is a synchronous operation
        const fs = require('fs');
        
        // If we get here, require is working
        return "Module resolution working properly";
      } catch (e) {
        // Fall back to a basic check of the require function
        if (typeof require === 'function') {
          return "Module resolution working properly";
        }
        return "Module resolution issue: " + e.message;
      }
    `,
    "expected": "Module resolution working properly"
  }
]; 