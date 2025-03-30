// Tests for ensuring the last expression is properly returned from REPL

export default [
  {
    name: "Return object literal without return statement",
    code: "const obj = { a: 1, b: 2 };\nobj;",
    expected: { a: 1, b: 2 }
  },
  {
    name: "Return variable assignment",
    code: "const x = 42;",
    expected: 42
  },
  {
    name: "Return complex object",
    code: `const result = {
  nodeVersion: process.version,
  platform: process.platform,
  workingDir: process.cwd(),
  env: process.env.NODE_ENV
};

result;`,
    expected: "Object with nodeVersion, platform, workingDir properties"
  },
  {
    name: "Return fetch test result",
    code: `const result = {};
result.fetchAvailable = typeof fetch === 'function';
result;`,
    expected: { fetchAvailable: true }
  },
  {
    name: "Return from multi-statement code without explicit return",
    code: `// Multiple statements
const dotenv = require('dotenv');
const path = require('path');

// Process
const result = {
  nodeEnv: process.env.NODE_ENV,
  currentPath: path.resolve('./'),
  fetchAvailable: typeof fetch === 'function'
};

// Modify the result
result.modified = true;

// The result object should be returned
result;`,
    expected: {
      nodeEnv: "node_env_value",
      currentPath: "any_path_string",
      fetchAvailable: true,
      modified: true
    }
  },
  {
    name: "Return from try/catch block",
    code: `try {
  const data = { success: true, message: 'OK' };
  data;
} catch (error) {
  { error: error.message };
}`,
    expected: { success: true, message: 'OK' }
  },
  {
    name: "Return from async code with await",
    code: `const promise = Promise.resolve({ asyncResult: 'success' });
const result = await promise;
result;`,
    expected: { asyncResult: 'success' }
  },
  {
    name: "Return from conditional expression",
    code: `const condition = true;
condition ? 'truthy result' : 'falsy result';`,
    expected: 'truthy result'
  }
]; 