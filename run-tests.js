#!/usr/bin/env node

/**
 * Comprehensive test runner for the REPL server
 * Generates test files and runs them individually
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import util from 'util';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const TEMP_DIR = path.join(__dirname, 'temp');
const TEST_DIR = path.join(__dirname, 'tests');

// Create directories if they don't exist
for (const dir of [TEMP_DIR, TEST_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Template for running tests
const TEMPLATE_FILE = path.join(TEMP_DIR, 'repl-template.cjs');

// Test categories and test cases
const TEST_CASES = [
  // Basic tests
  {
    category: 'basic',
    tests: [
      {
        name: 'Variable declaration',
        code: 'const x = 10; x;',
        validate: result => result.success && result.result === 10
      },
      {
        name: 'String operations',
        code: 'const s = "hello"; s.toUpperCase();',
        validate: result => result.success && result.result === 'HELLO'
      },
      {
        name: 'Number operations',
        code: 'const n = 5; n * 2;',
        validate: result => result.success && result.result === 10
      },
      {
        name: 'Boolean operations',
        code: 'const b = true; !b;',
        validate: result => result.success && result.result === false
      },
      {
        name: 'Array declaration',
        code: 'const arr = [1, 2, 3]; arr;',
        validate: result => result.success && Array.isArray(result.result) && result.result.length === 3
      },
      {
        name: 'Object declaration',
        code: 'const obj = { a: 1, b: 2 }; obj;',
        validate: result => result.success && result.result && result.result.a === 1 && result.result.b === 2
      }
    ]
  },
  // Console tests
  {
    category: 'console',
    tests: [
      {
        name: 'Console log',
        code: 'console.log("test message"); true;',
        validate: result => result.success && result.logs.some(l => l[0] === 'log' && l[1] === 'test message')
      },
      {
        name: 'Console error',
        code: 'console.error("error message"); true;',
        validate: result => result.success && result.logs.some(l => l[0] === 'error' && l[1] === 'error message')
      },
      {
        name: 'Console with multiple arguments',
        code: 'console.log("a", "b", "c"); true;',
        validate: result => result.success && result.logs.some(l => l[0] === 'log' && l[1] === 'a b c')
      },
      {
        name: 'Console with object',
        code: 'console.log({ a: 1, b: 2 }); true;',
        validate: result => result.success && result.logs.some(l => l[0] === 'log')
      }
    ]
  },
  // Process tests
  {
    category: 'process',
    tests: [
      {
        name: 'Process platform',
        code: 'process.platform;',
        validate: result => result.success && typeof result.result === 'string'
      },
      {
        name: 'Process version',
        code: 'process.version;',
        validate: result => result.success && typeof result.result === 'string' && result.result.startsWith('v')
      },
      {
        name: 'Process.cwd',
        code: 'process.cwd();',
        validate: result => result.success && typeof result.result === 'string'
      },
      {
        name: 'Process.env',
        code: 'process.env.NODE_ENV;',
        validate: result => result.success && result.result === 'test'
      }
    ]
  },
  // Async tests
  {
    category: 'async',
    tests: [
      {
        name: 'Async/await basic',
        code: 'await new Promise(resolve => setTimeout(() => resolve("done"), 10));',
        validate: result => result.success && result.result === 'done'
      },
      {
        name: 'Fetch basic',
        code: 'const response = await fetch("https://example.com"); await response.json();',
        validate: result => result.success && result.result && result.result.message === 'Mock response'
      },
      {
        name: 'Multiple awaits',
        code: `
          const a = await new Promise(resolve => setTimeout(() => resolve(1), 10));
          const b = await new Promise(resolve => setTimeout(() => resolve(2), 10));
          a + b;
        `,
        validate: result => result.success && result.result === 3
      }
    ]
  },
  // Expression tests
  {
    category: 'expressions',
    tests: [
      {
        name: 'Object destructuring',
        code: 'const { a, b } = { a: 1, b: 2 }; a + b;',
        validate: result => result.success && result.result === 3
      },
      {
        name: 'Array destructuring',
        code: 'const [a, b] = [1, 2]; a + b;',
        validate: result => result.success && result.result === 3
      },
      {
        name: 'Arrow functions',
        code: 'const add = (a, b) => a + b; add(2, 3);',
        validate: result => result.success && result.result === 5
      },
      {
        name: 'Template literals',
        code: 'const name = "world"; `hello ${name}`;',
        validate: result => result.success && result.result === 'hello world'
      }
    ]
  },
  // Error tests
  {
    category: 'errors',
    tests: [
      {
        name: 'Reference error',
        code: 'notDefined;',
        validate: result => !result.success && result.error && result.error.message.includes('notDefined')
      },
      {
        name: 'Syntax error',
        code: 'const x = ;',
        validate: result => !result.success
      },
      {
        name: 'Type error',
        code: 'const x = null; x.nonExistent;',
        validate: result => !result.success && result.error && result.error.message.includes('null')
      },
      {
        name: 'Error handling with try/catch',
        code: 'try { throw new Error("test error"); } catch (err) { err.message; }',
        validate: result => result.success && result.result === 'test error'
      }
    ]
  }
];

// Get the template content or create a default one
function getTemplateContent() {
  if (fs.existsSync(TEMPLATE_FILE)) {
    return fs.readFileSync(TEMPLATE_FILE, 'utf8');
  }
  
  // Default minimal template
  return `
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function(...args) {
      const formatted = args.join(' ');
      logs.push(['log', formatted]);
      originalLog(...args);
    };
    
    console.error = function(...args) {
      const formatted = args.join(' ');
      logs.push(['error', formatted]);
      originalError(...args);
    };
    
    global.process = {
      platform: '${process.platform}',
      version: '${process.version}',
      cwd: function() { return '${process.cwd().replace(/\\/g, '\\\\')}'; },
      env: { NODE_ENV: 'test' },
      nextTick: function(callback) { setTimeout(callback, 0); }
    };
    
    global.fetch = async function(url, options = {}) {
      console.log(\`Fetch request to: \${url}\`);
      return {
        ok: true,
        status: 200,
        json: async () => ({ message: "Mock response" })
      };
    };
    
    (async function runTest() {
      let result;
      let success = true;
      let error = null;
      
      try {
        result = await (async () => {
          // TEST_CODE_PLACEHOLDER
          return "Default result";
        })();
      } catch (err) {
        success = false;
        error = {
          message: err.message,
          stack: err.stack
        };
        console.error('Error:', err.message);
      }
      
      console.log('TEST_RESULT:', JSON.stringify({
        success,
        result,
        logs,
        error
      }));
    })();
  `;
}

// Create and run a test case
async function runTest(category, test) {
  const { name, code } = test;
  console.log(`Running test [${category}] ${name}...`);
  
  // Get the template content
  const templateContent = getTemplateContent();
  
  // Replace the placeholder with the actual test code
  const testContent = templateContent.replace('// TEST_CODE_PLACEHOLDER', code);
  
  // Create a temporary test file
  const testFile = path.join(TEMP_DIR, `test-${Date.now()}.cjs`);
  fs.writeFileSync(testFile, testContent);
  
  // Run the test
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('node', [testFile], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code !== 0) {
          // For error tests, this might be expected
          if (category === 'errors') {
            resolve({ stderr, stdout, code });
          } else {
            reject(new Error(`Process exited with code ${code}: ${stderr}`));
          }
          return;
        }
        
        resolve({ stdout, stderr, code });
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
    
    // Try to parse the test result
    try {
      // Extract the JSON result from the output
      const resultMatch = result.stdout.match(/TEST_RESULT: (\{.*\})/);
      if (resultMatch) {
        const testResult = JSON.parse(resultMatch[1]);
        
        // Validate the result
        const isValid = test.validate(testResult);
        
        if (isValid) {
          console.log(`  ✅ PASSED: "${name}"`);
          return { success: true, name, category };
        } else {
          console.log(`  ❌ FAILED: "${name}" (validation failed)`);
          console.log(`    Result: ${JSON.stringify(testResult.result)}`);
          return { success: false, name, category, reason: 'validation' };
        }
      } else {
        console.log(`  ❌ FAILED: "${name}" (no result found)`);
        console.log(`    Output: ${result.stdout}`);
        return { success: false, name, category, reason: 'no-result' };
      }
    } catch (parseError) {
      console.log(`  ❌ FAILED: "${name}" (parse error: ${parseError.message})`);
      console.log(`    Output: ${result.stdout}`);
      return { success: false, name, category, reason: 'parse-error' };
    }
  } catch (runError) {
    console.log(`  ❌ ERROR: "${name}" (${runError.message})`);
    return { success: false, name, category, reason: 'run-error' };
  } finally {
    // Clean up the test file
    try {
      fs.unlinkSync(testFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

// Run all tests in a category
async function runCategory(category) {
  const { category: categoryName, tests } = category;
  console.log(`\n=== Running category: ${categoryName} (${tests.length} tests) ===`);
  
  const results = [];
  for (const test of tests) {
    const result = await runTest(categoryName, test);
    results.push(result);
  }
  
  const passed = results.filter(r => r.success).length;
  console.log(`\n  Category ${categoryName}: ${passed}/${tests.length} passed`);
  
  return results;
}

// Run all test categories
async function runAllTests() {
  console.log('=== Starting REPL Server Test Suite ===');
  console.log(`Total categories: ${TEST_CASES.length}`);
  console.log(`Total tests: ${TEST_CASES.reduce((sum, cat) => sum + cat.tests.length, 0)}`);
  
  const results = [];
  for (const category of TEST_CASES) {
    const categoryResults = await runCategory(category);
    results.push(...categoryResults);
  }
  
  // Print summary
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  
  if (failedTests > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.success).forEach(({ name, category, reason }) => {
      console.log(`- [${category}] ${name} (${reason})`);
    });
  }
  
  console.log('====================');
  
  return failedTests === 0;
}

// Run the tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}); 