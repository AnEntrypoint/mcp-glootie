import { spawn } from 'child_process';
import * as path from 'node:path';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';

/**
 * Rule testing and validation tool for ast-grep
 * Provides comprehensive rule testing, validation, and debugging capabilities
 */

const executeAstGrepCommand = async (args, workingDirectory, timeout = 30000) => {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const childProcess = spawn('ast-grep', args, {
      cwd: workingDirectory,
      timeout,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data) => {
      stdout += data;
    });
    
    childProcess.stderr.on('data', (data) => {
      stderr += data;
    });
    
    childProcess.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;
      let parsedOutput = null;
      let jsonError = null;
      
      try {
        if (stdout.trim()) {
          parsedOutput = JSON.parse(stdout);
        }
      } catch (e) {
        jsonError = e.message;
      }
      
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        parsedOutput,
        jsonError,
        executionTimeMs,
        command: `ast-grep ${args.join(' ')}`
      });
    });
    
    childProcess.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
        executionTimeMs: Date.now() - startTime,
        command: `ast-grep ${args.join(' ')}`
      });
    });
  });
};

export const astgrepTestRules = async (options = {}) => {
  const {
    rulesPath,
    testCases = [],
    createTestSuite = false,
    outputFormat = 'detailed',
    workingDirectory
  } = options;

  const startTime = Date.now();
  
  try {
    let rules;
    let testResults = [];

    // Load rules from path or use provided rules
    if (rulesPath) {
      if (!existsSync(path.resolve(workingDirectory, rulesPath))) {
        throw new Error(`Rules file not found: ${rulesPath}`);
      }
      rules = readFileSync(path.resolve(workingDirectory, rulesPath), 'utf8');
    } else if (options.rules) {
      rules = options.rules;
    } else {
      throw new Error('Either rulesPath or rules must be provided');
    }

    // Create test suite if requested
    if (createTestSuite && testCases.length === 0) {
      const generatedTests = generateTestCasesFromRules(rules);
      testCases.push(...generatedTests);
    }

    // Run tests for each test case
    for (const testCase of testCases) {
      const testResult = await runSingleRuleTest(testCase, rules, workingDirectory);
      testResults.push(testResult);
    }

    // Generate summary
    const summary = generateTestSummary(testResults);
    
    return {
      success: true,
      testResults,
      summary,
      executionTimeMs: Date.now() - startTime,
      outputFormat
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTimeMs: Date.now() - startTime
    };
  }
};

export const astgrepValidateRules = async (rules, options = {}) => {
  const {
    validateSyntax = true,
    validateLogic = true,
    validatePerformance = true,
    performanceThreshold = 5000, // 5 seconds
    workingDirectory
  } = options;

  const validationResults = {
    syntaxValidation: null,
    logicValidation: null,
    performanceValidation: null,
    overallValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Syntax validation
    if (validateSyntax) {
      validationResults.syntaxValidation = await validateRuleSyntax(rules, workingDirectory);
      if (!validationResults.syntaxValidation.valid) {
        validationResults.overallValid = false;
        validationResults.errors.push(...validationResults.syntaxValidation.errors);
      }
    }

    // Logic validation
    if (validateLogic) {
      validationResults.logicValidation = await validateRuleLogic(rules, workingDirectory);
      if (!validationResults.logicValidation.valid) {
        validationResults.overallValid = false;
        validationResults.errors.push(...validationResults.logicValidation.errors);
      }
      validationResults.warnings.push(...(validationResults.logicValidation.warnings || []));
    }

    // Performance validation
    if (validatePerformance) {
      validationResults.performanceValidation = await validateRulePerformance(
        rules, 
        performanceThreshold, 
        workingDirectory
      );
      if (!validationResults.performanceValidation.acceptable) {
        validationResults.warnings.push(...validationResults.performanceValidation.warnings);
      }
    }

    return {
      success: true,
      validation: validationResults
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      validation: validationResults
    };
  }
};

export const astgrepDebugRule = async (ruleId, options = {}) => {
  const {
    rulesPath,
    testCode,
    language = 'javascript',
    verboseOutput = true,
    workingDirectory
  } = options;

  try {
    // Create temporary test file if test code provided
    let testFilePath = null;
    if (testCode) {
      const tempDir = path.join(workingDirectory, '.ast-grep-temp');
      mkdirSync(tempDir, { recursive: true });
      
      const extension = getLanguageExtension(language);
      testFilePath = path.join(tempDir, `debug-test${extension}`);
      writeFileSync(testFilePath, testCode, 'utf8');
    }

    // Run ast-grep with debug flags
    const args = ['run'];
    if (rulesPath) {
      args.push('--rule', rulesPath);
    }
    if (ruleId) {
      args.push('--filter', ruleId);
    }
    
    args.push('--json=pretty');
    args.push('--debug-query');
    
    if (testFilePath) {
      args.push(testFilePath);
    } else {
      args.push('.');
    }

    const result = await executeAstGrepCommand(args, workingDirectory);

    // Clean up temp file
    if (testFilePath) {
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(testFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    const debugInfo = {
      ruleId,
      command: result.command,
      executionTimeMs: result.executionTimeMs,
      success: result.success
    };

    if (result.success) {
      debugInfo.matches = result.parsedOutput || [];
      debugInfo.matchCount = Array.isArray(result.parsedOutput) ? result.parsedOutput.length : 0;
      debugInfo.debugOutput = result.stdout;
    } else {
      debugInfo.error = result.error || result.stderr;
      debugInfo.debugOutput = result.stderr;
    }

    return {
      success: true,
      debugInfo,
      rawOutput: verboseOutput ? result : null
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// Helper functions
const runSingleRuleTest = async (testCase, rules, workingDirectory) => {
  const {
    name,
    code,
    language = 'javascript',
    expectedMatches = 0,
    shouldMatch = true,
    ruleId
  } = testCase;

  // Create temporary rule file
  const tempRulePath = path.join(workingDirectory, '.ast-grep-temp', 'test-rules.yml');
  mkdirSync(path.dirname(tempRulePath), { recursive: true });
  writeFileSync(tempRulePath, rules, 'utf8');

  // Create temporary test file
  const extension = getLanguageExtension(language);
  const testFilePath = path.join(workingDirectory, '.ast-grep-temp', `test${extension}`);
  writeFileSync(testFilePath, code, 'utf8');

  try {
    const args = ['run', '--rule', tempRulePath, '--json=compact'];
    if (ruleId) {
      args.push('--filter', ruleId);
    }
    args.push(testFilePath);

    const result = await executeAstGrepCommand(args, workingDirectory);
    
    const matches = Array.isArray(result.parsedOutput) ? result.parsedOutput : [];
    const actualMatches = matches.length;
    
    const testResult = {
      name,
      passed: false,
      actualMatches,
      expectedMatches,
      shouldMatch,
      executionTimeMs: result.executionTimeMs,
      matches
    };

    // Determine if test passed
    if (typeof expectedMatches === 'number') {
      testResult.passed = actualMatches === expectedMatches;
    } else if (shouldMatch) {
      testResult.passed = actualMatches > 0;
    } else {
      testResult.passed = actualMatches === 0;
    }

    if (!testResult.passed) {
      testResult.failure = {
        expected: shouldMatch ? 'matches' : 'no matches',
        actual: actualMatches > 0 ? 'matches found' : 'no matches',
        details: `Expected ${expectedMatches} matches, got ${actualMatches}`
      };
    }

    return testResult;

  } catch (error) {
    return {
      name,
      passed: false,
      error: error.message,
      executionTimeMs: 0
    };
  } finally {
    // Clean up temp files
    try {
      const { unlinkSync } = await import('fs');
      unlinkSync(tempRulePath);
      unlinkSync(testFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
};

const validateRuleSyntax = async (rules, workingDirectory) => {
  // Create temporary rule file to test syntax
  const tempRulePath = path.join(workingDirectory, '.ast-grep-temp', 'syntax-test.yml');
  mkdirSync(path.dirname(tempRulePath), { recursive: true });
  writeFileSync(tempRulePath, rules, 'utf8');

  try {
    // Try to run ast-grep with the rules to check syntax
    const args = ['run', '--rule', tempRulePath, '--help'];
    const result = await executeAstGrepCommand(args, workingDirectory);

    // Clean up
    const { unlinkSync } = await import('fs');
    unlinkSync(tempRulePath);

    if (result.success) {
      return {
        valid: true,
        errors: []
      };
    } else {
      return {
        valid: false,
        errors: [result.error || result.stderr || 'Syntax validation failed']
      };
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error.message]
    };
  }
};

const validateRuleLogic = async (rules, workingDirectory) => {
  const errors = [];
  const warnings = [];
  
  try {
    // Parse YAML to analyze rule structure
    const yaml = await import('js-yaml');
    const parsedRules = yaml.load(rules);
    
    if (!parsedRules || !parsedRules.rules) {
      errors.push('Rules file must contain a "rules" array');
      return { valid: false, errors, warnings };
    }

    for (const rule of parsedRules.rules) {
      // Check required fields
      if (!rule.id) {
        errors.push('Rule missing required "id" field');
      }
      if (!rule.message) {
        warnings.push(`Rule "${rule.id || 'unnamed'}" missing message field`);
      }
      if (!rule.rule && !rule.pattern) {
        errors.push(`Rule "${rule.id || 'unnamed'}" missing rule or pattern definition`);
      }

      // Check for common logical issues
      if (rule.rule?.any && Array.isArray(rule.rule.any) && rule.rule.any.length === 1) {
        warnings.push(`Rule "${rule.id}" uses "any" with single condition - consider simplifying`);
      }

      if (rule.severity && !['error', 'warning', 'info', 'hint'].includes(rule.severity)) {
        warnings.push(`Rule "${rule.id}" has invalid severity: ${rule.severity}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };

  } catch (error) {
    // If js-yaml is not available, do basic text analysis
    const lines = rules.split('\n');
    let hasRulesSection = false;
    let hasValidRule = false;

    for (const line of lines) {
      if (line.trim().startsWith('rules:')) {
        hasRulesSection = true;
      }
      if (line.trim().startsWith('- id:') || line.trim().startsWith('-   id:')) {
        hasValidRule = true;
      }
    }

    if (!hasRulesSection) {
      errors.push('Rules file must contain a "rules:" section');
    }
    if (!hasValidRule) {
      warnings.push('No rules with "id" field found');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
};

const validateRulePerformance = async (rules, threshold, workingDirectory) => {
  // Create a simple test to measure rule performance
  const testCode = `
    function example() {
      console.log("test");
      return 42;
    }
    
    class TestClass {
      method() {
        this.value = 100;
      }
    }
  `;

  const tempRulePath = path.join(workingDirectory, '.ast-grep-temp', 'perf-test-rules.yml');
  const testFilePath = path.join(workingDirectory, '.ast-grep-temp', 'perf-test.js');
  
  mkdirSync(path.dirname(tempRulePath), { recursive: true });
  writeFileSync(tempRulePath, rules, 'utf8');
  writeFileSync(testFilePath, testCode, 'utf8');

  try {
    const args = ['run', '--rule', tempRulePath, '--json=compact', testFilePath];
    const result = await executeAstGrepCommand(args, workingDirectory, threshold + 1000);

    // Clean up
    const { unlinkSync } = await import('fs');
    unlinkSync(tempRulePath);
    unlinkSync(testFilePath);

    const warnings = [];
    if (result.executionTimeMs > threshold) {
      warnings.push(`Rule execution took ${result.executionTimeMs}ms, exceeding threshold of ${threshold}ms`);
    }

    if (result.executionTimeMs > threshold * 2) {
      warnings.push('Rule performance is significantly slow - consider optimization');
    }

    return {
      acceptable: result.executionTimeMs <= threshold,
      executionTimeMs: result.executionTimeMs,
      threshold,
      warnings
    };

  } catch (error) {
    return {
      acceptable: false,
      error: error.message,
      warnings: ['Could not measure performance due to error']
    };
  }
};

const generateTestCasesFromRules = (rules) => {
  // Generate basic test cases based on common patterns
  const testCases = [];
  
  // Add some common JavaScript patterns to test against
  const commonPatterns = [
    {
      name: 'Function declaration test',
      code: 'function testFunction(param) { return param; }',
      language: 'javascript'
    },
    {
      name: 'Console log test',
      code: 'console.log("hello world");',
      language: 'javascript'
    },
    {
      name: 'Class declaration test',
      code: 'class TestClass { constructor() { this.value = 42; } }',
      language: 'javascript'
    },
    {
      name: 'Arrow function test',
      code: 'const arrow = (x) => { return x * 2; };',
      language: 'javascript'
    },
    {
      name: 'Empty test',
      code: '// Empty file',
      language: 'javascript',
      expectedMatches: 0
    }
  ];

  return commonPatterns;
};

const generateTestSummary = (testResults) => {
  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const errors = testResults.filter(r => r.error).length;
  
  const avgExecutionTime = testResults.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / total;
  
  return {
    total,
    passed,
    failed,
    errors,
    successRate: Math.round((passed / total) * 100),
    averageExecutionTime: Math.round(avgExecutionTime),
    failedTests: testResults.filter(r => !r.passed).map(r => ({
      name: r.name,
      error: r.error,
      failure: r.failure
    }))
  };
};

const getLanguageExtension = (language) => {
  const extensions = {
    javascript: '.js',
    typescript: '.ts',
    python: '.py',
    rust: '.rs',
    go: '.go',
    java: '.java',
    cpp: '.cpp',
    c: '.c'
  };
  
  return extensions[language.toLowerCase()] || '.js';
};