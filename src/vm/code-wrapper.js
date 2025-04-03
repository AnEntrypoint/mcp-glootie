import { debugLog, detectCodeType } from '../utils.js';

/**
 * Wraps code to be executed in the VM context with enhanced handling for various code patterns
 * @param {string} code - The code to execute
 * @returns {string} - The wrapped code ready for execution
 */
export function wrapCode(code) {
  debugLog('Wrapping code for execution');

  // Analyze the code to see if it has top-level awaits or is an async function
  const hasTopLevelAwait = /\bawait\b/.test(code) && !/\basync\s+function|\basync\s+\(|\)\s*=>\s*{/.test(code);
  const isAsyncFunction = /\basync\s+function|\basync\s+\(|\basync\s*\)\s*=>/.test(code);

  // Clean up the code by removing comments and trimming
  const cleanedCode = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();

  // Check if the code is already a complete function declaration
  const isCompleteFunction = /^(async\s+)?function\s+\w+\s*\([^)]*\)\s*{[\s\S]*}$/.test(cleanedCode);

  // Check if the code has a return statement
  const hasReturnStatement = /\breturn\b/.test(cleanedCode);

  // Check if the code contains specific assignment patterns
  const hasAssignment = /=\s*[^=]/.test(cleanedCode);

  // Advanced detection for object literals - more precise matching
  const hasObjectPropertySyntax = /\w+\s*:\s*[^,}]*[,}]/.test(cleanedCode);
  const objectLiteralRegex = /{[\s\S]*?:[\s\S]*?}/;
  const hasObjectLiteral = objectLiteralRegex.test(cleanedCode) && hasObjectPropertySyntax;

  // Improved detection for functions within object literals
  const hasFunctionInObject = /{\s*[^}]*?:\s*(?:function|=>)/.test(cleanedCode) ||
                             /{\s*[^}]*?:\s*\([^)]*\)\s*=>/.test(cleanedCode) ||
                             /{\s*[^}]*?:\s*async\s+function/.test(cleanedCode) ||
                             /{\s*[^}]*?\(\s*[^)]*\)\s*{/.test(cleanedCode);

  // More precise detection for object literal at the start of code
  const startsWithObjectLiteral = /^\s*{[\s\S]*?:[\s\S]*?}/.test(cleanedCode) &&
                                 hasObjectPropertySyntax &&
                                 !cleanedCode.startsWith('if') &&
                                 !cleanedCode.startsWith('for') &&
                                 !cleanedCode.startsWith('while') &&
                                 !cleanedCode.startsWith('function');

  // Detect if code ends with an object literal
  const endsWithObjectLiteral = /[\s\S]*{[\s\S]*?:[\s\S]*?}\s*$/.test(cleanedCode) &&
                                !cleanedCode.trim().endsWith(';') &&
                                hasObjectPropertySyntax;

  // Detect if code is ONLY an object literal
  const isOnlyObjectLiteral = /^\s*{[\s\S]*?:[\s\S]*?}\s*$/.test(cleanedCode) &&
                             hasObjectPropertySyntax &&
                             !cleanedCode.includes('function') &&
                             !cleanedCode.includes('if') &&
                             !cleanedCode.includes('for');

  // Check if the last line has an object literal
  const lastLineRegex = /[^;{}]*{[^{}]*:[^{}]*}[^;{}]*$/;
  const lastLineHasObjectLiteral = lastLineRegex.test(cleanedCode);

  // Better array literal detection
  const hasArrayLiteral = /\[[\s\S]*?\]/.test(cleanedCode);

  // Check for throw statements
  const hasThrow = /\bthrow\s+/.test(cleanedCode);

  // Check for try-catch blocks
  const hasTryCatch = /\btry\s*{/.test(cleanedCode) && /\bcatch\s*\(/.test(cleanedCode);

  // Check for multiline/complex code
  const isMultiline = (cleanedCode.match(/\n/g) || []).length > 0;
  const hasMultipleStatements = cleanedCode.includes(';');

  // Log detailed code characteristics for debugging
  debugLog(`Code characteristics: ${JSON.stringify({
    hasTopLevelAwait,
    isAsyncFunction,
    isCompleteFunction,
    hasReturnStatement,
    hasAssignment,
    hasObjectLiteral,
    hasObjectPropertySyntax,
    hasFunctionInObject,
    startsWithObjectLiteral,
    isOnlyObjectLiteral,
    endsWithObjectLiteral,
    lastLineHasObjectLiteral,
    hasArrayLiteral,
    hasThrow,
    hasTryCatch,
    isMultiline,
    hasMultipleStatements,
    length: code.length
  })}`);

  // Special case for try/catch blocks that return objects
  if (hasTryCatch && hasObjectLiteral && !hasReturnStatement) {
    return `(async () => {
      ${code.includes('return ') ? code : `
      try {
        ${code}
        // Add implicit return for the last object
        return ${code.trim().endsWith(';') ? 'undefined' : 'result'};
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }`}
    })()`;
  }

  // Special case for object literals with functions - need more careful handling
  if (hasObjectLiteral && hasFunctionInObject) {
    return `(async () => {
      try {
        ${hasReturnStatement ? code : `return ${code};`}
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }

  // Special case: The code is just an object literal without return
  if (isOnlyObjectLiteral || (startsWithObjectLiteral && !hasMultipleStatements)) {
    // Always prepend 'return' to object literals that are the entire expression
    return `(async () => {
      try {
        return ${code};
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }

  // Special case: Check if the code is an object literal with a return statement already
  if (hasReturnStatement && hasObjectLiteral) {
    // Make sure we don't wrap an already-wrapped object literal return
    return `(async () => {
      try {
        ${code}
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }

  // If the code already has an explicit return statement
  if (hasReturnStatement) {
    return `(async () => {
      try {
        ${code}
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Special handling for empty return statements
  else if (code.trim() === 'return' || code.trim() === 'return;') {
    return `(async () => {
      try {
        return undefined;
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Handle code with throw statements - must be wrapped to catch errors
  else if (hasThrow) {
    return `(async () => {
      try {
        ${code}
        return undefined;
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Handle code with try-catch blocks - likely already handling errors
  else if (hasTryCatch) {
    return `(async () => {
      try {
        ${code}
        return undefined;
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Handle top-level await - must use async function
  else if (hasTopLevelAwait) {
    return `(async () => {
      try {
        return ${code};
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Handle async functions - already async, just needs error handling
  else if (isAsyncFunction) {
    return `(async () => {
      try {
        return ${code};
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Handle simple expressions - return their value directly
  else if (!isMultiline && !hasMultipleStatements) {
    // Special case for simple assignments without returns
    if (hasAssignment ||
        code.trim().startsWith('const ') ||
        code.trim().startsWith('let ') ||
        code.trim().startsWith('var ')) {
      return `(async () => {
        try {
          ${code.trim().endsWith(';') ? code : code + ';'}
          return undefined;
        } catch (e) {
          console.error('ERROR:', e);
          throw e;
        }
      })()`;
    }

    return `(async () => {
      try {
        return ${code};
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
  // Handle multiline code without explicit return - extract last expression
  else {
    const lines = code.split('\n');
    let lastLine = lines[lines.length - 1].trim();

    // Special handling for variable declarations without return
    if (code.trim().startsWith('const ') || code.trim().startsWith('let ') || code.trim().startsWith('var ')) {
      // For single-line variable declarations, add return undefined
      if (!code.includes('\n')) {
        return `(async () => {
          try {
            ${code};
            return undefined;
          } catch (e) {
            console.error('ERROR:', e);
            throw e;
          }
        })()`;
      }
    }

    // Special handling for object literals at the end of multi-line code
    if (lastLineHasObjectLiteral || endsWithObjectLiteral) {
      // Make sure we don't add return if it already has one
      if (!lastLine.startsWith('return ')) {
        lines[lines.length - 1] = `return ${lastLine};`;
      }
    }
    // If the last line looks like an expression (no semicolon, not a block end)
    // and not a comment, return it
    else if (lastLine &&
             !lastLine.endsWith(';') &&
             !lastLine.endsWith('}') &&
             !lastLine.startsWith('//') &&
             !lastLine.startsWith('return ')) {
      lines[lines.length - 1] = `return ${lastLine};`;
    }
    // For simple variables as the last line (e.g. "result;")
    else if (lastLine &&
            !lastLine.startsWith('return ') &&
            !lastLine.endsWith(';') &&
            !lastLine.endsWith('}') &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastLine)) {
      lines[lines.length - 1] = `return ${lastLine};`;
    }
    else if (!lastLine.startsWith('return ') &&
               !lastLine.endsWith(';') &&
               isOnlyObjectLiteral) {
      // For simple object literals as the last line
      lines[lines.length - 1] = `return ${lastLine};`;
    }
    // For ending with variable declaration or assignment
    else if (lastLine.startsWith('const ') || lastLine.startsWith('let ') || lastLine.startsWith('var ')) {
      // Add the semicolon if missing and ensure undefined is returned
      if (!lastLine.endsWith(';')) {
        lines[lines.length - 1] = `${lastLine};`;
      }
      lines.push('return undefined;');
    }
    // For single variable name ending with semicolon (e.g. "result;")
    else if (lastLine.endsWith(';') &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*;$/.test(lastLine)) {
      // Replace semicolon with a return statement
      lines[lines.length - 1] = `return ${lastLine.substring(0, lastLine.length - 1)};`;
    }

    return `(async () => {
      try {
        ${lines.join('\n')}
      } catch (e) {
        console.error('ERROR:', e);
        throw e;
      }
    })()`;
  }
}