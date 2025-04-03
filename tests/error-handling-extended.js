/**
 * Extended error handling test cases
 */

export default [
  {
    "name": "Async error with stack trace",
    "code": "async function throwAsync() { throw new Error('Async error'); }; await throwAsync();",
    "expectedError": "Error: Async error",
    "expected": ({ outputs, returnValue, fullOutput, error }) => {
      const allText = [fullOutput, returnValue, error, ...(outputs || [])].join(' ');
      return allText.includes('Async error') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine') || 
              allText.includes('at throwAsync') || allText.includes('at Object.'));
    }
  },
  {
    "name": "Promise rejection",
    "code": "await Promise.reject(new Error('Promise rejected')).catch(err => { throw err; });",
    "expectedError": "Error: Promise rejected",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Promise rejected') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine'));
    }
  },
  {
    "name": "Error with cause",
    "code": "const cause = new Error('Root cause'); throw new Error('Main error', { cause });",
    "expectedError": "Error: Main error",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Main error') && 
             allText.includes('Root cause') &&
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine'));
    }
  },
  {
    "name": "Error in setTimeout",
    "code": `
      let errorObj;
      await new Promise(resolve => {
        setTimeout(() => {
          try {
            throw new Error('Delayed error');
          } catch (err) {
            errorObj = err;
          }
          resolve();
        }, 10);
      });
      if (errorObj) throw errorObj;
    `,
    "expectedError": "Error: Delayed error",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Delayed error') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine'));
    }
  },
  {
    "name": "Error with non-enumerable properties",
    "code": `
      const err = new Error('Hidden props');
      Object.defineProperty(err, 'secret', {
        value: 'hidden',
        enumerable: false
      });
      throw err;
    `,
    "expectedError": "Error: Hidden props",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Hidden props') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine'));
    }
  },
  {
    "name": "Error with circular reference",
    "code": `
      const err = new Error('Circular');
      err.self = err;
      throw err;
    `,
    "expectedError": "Error: Circular",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Circular') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine'));
    }
  },
  {
    "name": "Error with custom stack",
    "code": `
      const err = new Error('Custom stack');
      err.stack = 'Error: Custom stack\\n    at customFunc (eval:1:1)';
      throw err;
    `,
    "expectedError": "Error: Custom stack",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Custom stack') && 
             allText.includes('customFunc') &&
             (allText.includes('Error:') || allText.includes('ERROR:'));
    }
  },
  {
    "name": "Error with line numbers in message",
    "code": `
      function parseCode(line) {
        throw new Error(\`Parse error at line \${line}\`);
      }
      parseCode(42);
    `,
    "expectedError": "Error: Parse error at line 42",
    "expected": ({ outputs, returnValue, fullOutput }) => {
      const allText = [fullOutput, returnValue, ...(outputs || [])].join(' ');
      return allText.includes('Parse error at line 42') && 
             (allText.includes('Error:') || allText.includes('ERROR:')) &&
             (allText.includes('at eval') || allText.includes('at evalmachine'));
    }
  }
]; 