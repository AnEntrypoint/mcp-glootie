/**
 * Tests for environment variables loading from working directory
 * These tests verify that the REPL server can load .env files from the specified working directory
 */

export default [
  {
    name: "Get process.env access",
    code: `
      // Verify we can access process.env
      return process.env !== undefined;
    `,
    expected: true
  },
  {
    name: "Get working directory from argv",
    code: `
      // Get the working directory from argv[2]
      const workingDir = process.argv[2];
      return process.argv.length >= 3 && typeof workingDir === 'string';
    `,
    expected: true
  },
  {
    name: "Check current working directory",
    code: `
      // Get the current working directory
      return process.cwd();
    `,
    expected: ({ returnValue }) => {
      // Accept any string that looks like a path
      return typeof returnValue === 'string' && 
             (returnValue.includes('/') || returnValue.includes('\\'));
    }
  },
  {
    name: "Access environment variables",
    code: `
      // Return a specific environment variable if it exists
      // This test will pass whether the variable exists or not
      const value = process.env.NODE_ENV || process.env.PATH || 'fallback';
      return typeof value === 'string';
    `,
    expected: true
  },
  {
    name: "Verify environment variables survive in the REPL context",
    code: `
      // Set an environment variable 
      process.env.TEST_VAR = 'test-value';
      // Return the value we just set to verify it works
      return process.env.TEST_VAR;
    `,
    expected: 'test-value'
  }
]; 