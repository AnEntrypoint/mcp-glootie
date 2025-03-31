/**
 * Tests for returning object literal expressions
 * This tests a common pattern that was causing syntax errors
 */

export default [
  {
    "name": "Return simple object literal",
    "code": "return { a: 1, b: 2 }",
    "expected": "{ a: 1, b: 2 }"
  },
  {
    "name": "Return object literal with nested properties",
    "code": "return { a: 1, b: { c: 3, d: 4 } }",
    "expected": "{ a: 1, b: { c: 3, d: 4 } }"
  },
  {
    "name": "Return object literal at end of multi-line code",
    "code": "const x = 1;\nconst y = 2;\n\n{ x, y }",
    "expected": "{ x: 1, y: 2 }"
  },
  {
    "name": "Return object literal with function",
    "code": "return { name: 'Test', execute: () => 'result' }",
    "expected": "{ name: 'Test', execute: [Function: execute] }"
  },
  {
    "name": "Return complex object without return keyword",
    "code": "{\n  endpoints: { test: true },\n  summary: {\n    working: 5,\n    total: 5,\n    recommendation: 'All working'\n  }\n}",
    "expected": "{ endpoints: { test: true }, summary: { working: 5, total: 5, recommendation: 'All working' } }"
  },
  {
    "name": "Return from Promise.all with object literal",
    "code": "const results = await Promise.all([1, 2, 3].map(x => x * 2));\n\n{\n  results,\n  status: 'success'\n}",
    "expected": "{ results: [ 2, 4, 6 ], status: 'success' }"
  }
]; 