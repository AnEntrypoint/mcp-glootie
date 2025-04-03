/**
 * Test file to verify process.argv behavior in the REPL
 */

export default [
  {
    "name": "process.argv verification",
    "code": "return process.argv;",
    "expected": ({ returnValue }) => {
      if (typeof returnValue !== 'string') return false;
      const regex = /^\s*\[\s*\'.*?\'\s*,\s*\'.*?\'\s*,\s*\'.*?\'\s*\]\s*$/;
      return regex.test(returnValue.replace(/\n/g, ' '));
    }
  },
  {
    "name": "Access process object",
    "code": "return Object.keys(process).includes('argv');",
    "expected": "true"
  },
  {
    "name": "Check if full process object available",
    "code": "const processProps = Object.keys(process); const requiredProps = ['env', 'cwd']; const missingProps = requiredProps.filter(prop => !processProps.includes(prop)); return missingProps.length === 0 ? 'All required process properties available' : `Missing: ${missingProps.join(', ')}`;",
    "expected": "All required process properties available"
  },
  {
    "name": "REPL code execution context",
    "code": "// This would normally be available as process.argv[2] in a script\ntry {\n  // Attempt to access 'this' at the top level\n  const contextKeys = Object.keys(this);\n  return contextKeys.length > 0 ? 'Has global context' : 'Empty context';\n} catch (e) {\n  return e.message;\n}",
    "expected": "Has global context"
  },
  {
    "name": "Direct global variable access",
    "code": "// In a Node.js script, variables declared without 'var/let/const' are global\ntestVar = 'test';\nreturn testVar;",
    "expected": "test"
  },
  {
    "name": "Check sandbox environment",
    "code": "// Code in argv[2] would have these globals available\nreturn typeof Buffer !== 'undefined' && typeof setTimeout !== 'undefined' && typeof console !== 'undefined';",
    "expected": "true"
  }
]; 