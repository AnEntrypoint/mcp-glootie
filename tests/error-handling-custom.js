/**
 * Custom error handling tests
 */

export default [
  {
    name: "Custom error with explicit stack trace",
    code: "const err = new Error('Custom error with stack'); err.stack = 'Error: Custom error with stack\\n    at eval\\n    at someFunction'; throw err;",
    expectedError: "Error: Custom error with stack",
    expected: ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Custom error with stack') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             allText.includes('at eval');
    }
  },
  {
    name: "Simple custom error with message",
    code: "throw new Error('Custom error with stack');",
    expectedError: "Custom error with stack",
    expected: ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Custom error with stack') && 
             (allText.includes('Error:') || allText.includes('ERROR:'));
    }
  },
  {
    name: "Multi-line custom error",
    code: "function throwError() { throw new Error('Custom\\nerror\\nwith\\nmultiple\\nlines'); } throwError();",
    expectedError: "Custom\nerror\nwith\nmultiple\nlines",
    expected: ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Custom') && 
             allText.includes('lines') &&
             (allText.includes('Error:') || allText.includes('ERROR:'));
    }
  },
  {
    name: "Error with custom metadata properties",
    code: "const err = new Error('Metadata error'); err.code = 'TEST_ERROR'; err.details = { important: true }; throw err;",
    expectedError: "Metadata error",
    expected: ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Metadata error') && 
             allText.includes('TEST_ERROR') &&
             (allText.includes('Error:') || allText.includes('ERROR:'));
    }
  }
]; 