import { spawn } from 'child_process';
import * as path from 'node:path';

/**
 * Advanced search capabilities for ast-grep
 * Supports multiple patterns, constraints, and meta-variable validation
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

export const multiPatternSearch = async (patterns, options = {}) => {
  const {
    language,
    paths = ['.'],
    operator = 'any', // 'any' (OR), 'all' (AND), 'not' (NOT)
    context,
    strictness,
    includeMetadata = true,
    workingDirectory
  } = options;

  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error('Patterns must be a non-empty array');
  }

  const allResults = [];
  const searchMetadata = {
    patterns: patterns.slice(),
    operator,
    startTime: new Date().toISOString()
  };

  // Execute searches for each pattern
  for (const pattern of patterns) {
    const args = ['run', '--json=compact'];
    if (language) args.push('--lang', language);
    args.push('--pattern', pattern);
    if (context && context > 0) args.push('--context', context.toString());
    if (strictness) args.push('--strictness', strictness);
    args.push(...paths);

    const result = await executeAstGrepCommand(args, workingDirectory);
    
    if (result.success && result.parsedOutput) {
      const transformedResults = Array.isArray(result.parsedOutput)
        ? result.parsedOutput.map(match => ({
            ...match,
            pattern,
            file: match.file,
            startLine: match.range?.start?.line || 0,
            endLine: match.range?.end?.line || 0,
            text: match.text || match.lines,
            metaVariables: match.metaVariables || {},
            language: match.language,
            range: match.range
          }))
        : [];
      
      allResults.push({
        pattern,
        matches: transformedResults,
        matchCount: transformedResults.length,
        executionTimeMs: result.executionTimeMs
      });
    } else {
      allResults.push({
        pattern,
        matches: [],
        matchCount: 0,
        error: result.error || result.stderr,
        executionTimeMs: result.executionTimeMs
      });
    }
  }

  // Apply operator logic to combine results
  const combinedResults = combinePatternResults(allResults, operator);

  return {
    success: true,
    operator,
    patternResults: allResults,
    combinedMatches: combinedResults,
    totalPatterns: patterns.length,
    totalCombinedMatches: combinedResults.length,
    ...(includeMetadata && { searchMetadata })
  };
};

export const constraintBasedSearch = async (pattern, constraints = {}, options = {}) => {
  const {
    language,
    paths = ['.'],
    context,
    strictness,
    workingDirectory
  } = options;

  const {
    minMatches,
    maxMatches,
    filePathPattern,
    metaVariableConstraints = {},
    contextConstraints = {},
    performanceThreshold
  } = constraints;

  const args = ['run', '--json=compact'];
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern);
  if (context && context > 0) args.push('--context', context.toString());
  if (strictness) args.push('--strictness', strictness);
  args.push(...paths);

  const startTime = Date.now();
  const result = await executeAstGrepCommand(args, workingDirectory);
  const executionTimeMs = Date.now() - startTime;

  if (!result.success) {
    return {
      success: false,
      error: result.error || result.stderr,
      executionTimeMs: result.executionTimeMs
    };
  }

  let matches = Array.isArray(result.parsedOutput) ? result.parsedOutput : [];

  // Apply file path constraints
  if (filePathPattern) {
    const pathRegex = new RegExp(filePathPattern);
    matches = matches.filter(match => pathRegex.test(match.file));
  }

  // Apply meta-variable constraints
  if (Object.keys(metaVariableConstraints).length > 0) {
    matches = matches.filter(match => 
      validateMetaVariables(match.metaVariables, metaVariableConstraints)
    );
  }

  // Apply context constraints
  if (Object.keys(contextConstraints).length > 0) {
    matches = matches.filter(match =>
      validateContextConstraints(match, contextConstraints)
    );
  }

  // Apply count constraints
  if (minMatches !== undefined && matches.length < minMatches) {
    return {
      success: false,
      error: `Insufficient matches: found ${matches.length}, required minimum ${minMatches}`,
      actualMatches: matches.length,
      executionTimeMs
    };
  }

  if (maxMatches !== undefined && matches.length > maxMatches) {
    matches = matches.slice(0, maxMatches);
  }

  // Check performance threshold
  if (performanceThreshold && executionTimeMs > performanceThreshold) {
    return {
      success: false,
      error: `Performance threshold exceeded: ${executionTimeMs}ms > ${performanceThreshold}ms`,
      executionTimeMs
    };
  }

  const transformedMatches = matches.map(match => ({
    file: match.file,
    startLine: match.range?.start?.line || 0,
    endLine: match.range?.end?.line || 0,
    text: match.text || match.lines,
    metaVariables: match.metaVariables || {},
    language: match.language,
    range: match.range,
    constraintsApplied: {
      filePathPattern: !!filePathPattern,
      metaVariableConstraints: Object.keys(metaVariableConstraints).length > 0,
      contextConstraints: Object.keys(contextConstraints).length > 0
    }
  }));

  return {
    success: true,
    matches: transformedMatches,
    totalMatches: transformedMatches.length,
    constraintsApplied: constraints,
    executionTimeMs
  };
};

export const metaVariableValidation = async (pattern, validationRules = {}, options = {}) => {
  const {
    language,
    paths = ['.'],
    workingDirectory
  } = options;

  const args = ['run', '--json=compact'];
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern);
  args.push(...paths);

  const result = await executeAstGrepCommand(args, workingDirectory);

  if (!result.success) {
    return {
      success: false,
      error: result.error || result.stderr,
      executionTimeMs: result.executionTimeMs
    };
  }

  const matches = Array.isArray(result.parsedOutput) ? result.parsedOutput : [];
  const validationResults = [];

  for (const match of matches) {
    const metaVars = match.metaVariables || {};
    const validationResult = {
      file: match.file,
      startLine: match.range?.start?.line || 0,
      endLine: match.range?.end?.line || 0,
      metaVariables: metaVars,
      validationPassed: true,
      validationErrors: [],
      validationDetails: {}
    };

    // Validate each meta-variable according to rules
    for (const [varName, rules] of Object.entries(validationRules)) {
      const varValue = metaVars.single?.[varName]?.text || metaVars[varName];
      const varValidation = validateMetaVariable(varName, varValue, rules);
      
      validationResult.validationDetails[varName] = varValidation;
      
      if (!varValidation.passed) {
        validationResult.validationPassed = false;
        validationResult.validationErrors.push(...varValidation.errors);
      }
    }

    validationResults.push(validationResult);
  }

  const passedValidation = validationResults.filter(r => r.validationPassed);
  const failedValidation = validationResults.filter(r => !r.validationPassed);

  return {
    success: true,
    pattern,
    totalMatches: matches.length,
    validationResults,
    passedValidation: passedValidation.length,
    failedValidation: failedValidation.length,
    validationRules,
    executionTimeMs: result.executionTimeMs
  };
};

// Helper functions
const combinePatternResults = (patternResults, operator) => {
  if (operator === 'any') {
    // Union of all matches (OR operation)
    const allMatches = [];
    const seenMatches = new Set();
    
    for (const result of patternResults) {
      for (const match of result.matches) {
        const key = `${match.file}:${match.startLine}-${match.endLine}`;
        if (!seenMatches.has(key)) {
          seenMatches.add(key);
          allMatches.push(match);
        }
      }
    }
    return allMatches;
  }
  
  if (operator === 'all') {
    // Intersection of matches (AND operation)
    if (patternResults.length === 0) return [];
    
    let intersection = patternResults[0].matches.slice();
    
    for (let i = 1; i < patternResults.length; i++) {
      const currentMatches = new Set(
        patternResults[i].matches.map(m => `${m.file}:${m.startLine}-${m.endLine}`)
      );
      
      intersection = intersection.filter(match => {
        const key = `${match.file}:${match.startLine}-${match.endLine}`;
        return currentMatches.has(key);
      });
    }
    
    return intersection;
  }
  
  if (operator === 'not') {
    // First pattern results minus subsequent patterns (NOT operation)
    if (patternResults.length < 2) return patternResults[0]?.matches || [];
    
    const baseMatches = patternResults[0].matches.slice();
    const excludeKeys = new Set();
    
    for (let i = 1; i < patternResults.length; i++) {
      for (const match of patternResults[i].matches) {
        const key = `${match.file}:${match.startLine}-${match.endLine}`;
        excludeKeys.add(key);
      }
    }
    
    return baseMatches.filter(match => {
      const key = `${match.file}:${match.startLine}-${match.endLine}`;
      return !excludeKeys.has(key);
    });
  }
  
  return [];
};

const validateMetaVariables = (metaVariables, constraints) => {
  const metaVars = metaVariables?.single || metaVariables || {};
  
  for (const [varName, constraint] of Object.entries(constraints)) {
    const varValue = metaVars[varName]?.text || metaVars[varName];
    
    if (!varValue) {
      if (constraint.required) return false;
      continue;
    }
    
    // Apply regex constraint
    if (constraint.regex && !new RegExp(constraint.regex).test(varValue)) {
      return false;
    }
    
    // Apply type constraint (basic heuristics)
    if (constraint.type) {
      if (!validateVariableType(varValue, constraint.type)) {
        return false;
      }
    }
    
    // Apply length constraints
    if (constraint.minLength && varValue.length < constraint.minLength) return false;
    if (constraint.maxLength && varValue.length > constraint.maxLength) return false;
  }
  
  return true;
};

const validateContextConstraints = (match, constraints) => {
  // File-based constraints
  if (constraints.fileSize) {
    // Would need file system access to check file size
  }
  
  // Line-based constraints
  if (constraints.minLine && match.range?.start?.line < constraints.minLine) return false;
  if (constraints.maxLine && match.range?.start?.line > constraints.maxLine) return false;
  
  // Text-based constraints
  if (constraints.containsText && !match.text?.includes(constraints.containsText)) return false;
  if (constraints.excludesText && match.text?.includes(constraints.excludesText)) return false;
  
  return true;
};

const validateMetaVariable = (varName, varValue, rules) => {
  const result = {
    passed: true,
    errors: [],
    varName,
    varValue
  };
  
  if (!varValue) {
    if (rules.required) {
      result.passed = false;
      result.errors.push(`Meta-variable ${varName} is required but not found`);
    }
    return result;
  }
  
  // Regex validation
  if (rules.regex && !new RegExp(rules.regex).test(varValue)) {
    result.passed = false;
    result.errors.push(`${varName} does not match pattern: ${rules.regex}`);
  }
  
  // Type validation
  if (rules.type && !validateVariableType(varValue, rules.type)) {
    result.passed = false;
    result.errors.push(`${varName} is not of expected type: ${rules.type}`);
  }
  
  // Length validation
  if (rules.minLength && varValue.length < rules.minLength) {
    result.passed = false;
    result.errors.push(`${varName} is too short (${varValue.length} < ${rules.minLength})`);
  }
  
  if (rules.maxLength && varValue.length > rules.maxLength) {
    result.passed = false;
    result.errors.push(`${varName} is too long (${varValue.length} > ${rules.maxLength})`);
  }
  
  return result;
};

const validateVariableType = (value, expectedType) => {
  switch (expectedType.toLowerCase()) {
    case 'identifier':
      return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value);
    case 'string':
      return /^["'].*["']$/.test(value);
    case 'number':
      return /^\d+(\.\d+)?$/.test(value);
    case 'boolean':
      return /^(true|false)$/.test(value);
    case 'function':
      return value.includes('function') || /^\w+\s*\(.*\)\s*(\{|=>)/.test(value);
    default:
      return true; // Unknown types pass by default
  }
};