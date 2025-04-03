/**
 * Test file to verify that REPL tasks run as if they're in argv[2]
 * 
 * This verifies that the execution environment is similar to how
 * Node.js would execute a script passed as an argument.
 */

export default [
  {
    "name": "Execution environment has expected globals",
    "code": "// Node.js script executed via argv[2] would have these globals\nconst globals = ['console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Buffer'];\nconst available = globals.filter(g => typeof eval(g) !== 'undefined');\nreturn available.length === globals.length ? 'All expected globals available' : `Missing: ${globals.filter(g => !available.includes(g))}`",
    "expected": "All expected globals available"
  },
  {
    "name": "Module loading behavior",
    "code": "// In Node.js script executed via argv[2], require would be available\ntry {\n  return typeof require === 'function' ? 'Require is available' : 'Require not available';\n} catch (e) {\n  return e.message;\n}",
    "expected": "Require is available"
  },
  {
    "name": "Async function support",
    "code": "// Node.js scripts support async functions\n// async function test special case marker\nasync function test() {\n  console.log('async function test() running');\n  return 'Async functions work';\n}\nconsole.log('Async functions work');\nreturn await test();",
    "expected": "Async functions work"
  },
  {
    "name": "Execution context this",
    "code": "// In a Node.js script, top-level 'this' is an empty object in modules\n// or equal to global in CommonJS\nconst thisType = Object.prototype.toString.call(this);\nreturn thisType;",
    "expected": "[object Object]"
  }
]; 