import { validateWorkingDirectory } from './validation-utils.js';

/**
 * Enhanced ast-grep handlers for new MCP tools
 */

export const handleAstGrepEnhancedSearch = async (args, defaultWorkingDir, getEnhancedUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { pattern, language, paths, context, strictness, jsonFormat, includeMetadata } = args;
  if (!pattern) {
    return { content: [{ type: 'text', text: 'ERROR: Missing pattern argument for enhanced ast-grep search' }] };
  }
  
  try {
    const { enhancedAstGrepSearch } = await getEnhancedUtils();
    const result = await enhancedAstGrepSearch(pattern, {
      language,
      paths,
      context,
      strictness,
      jsonFormat: jsonFormat || 'compact',
      includeMetadata: includeMetadata !== false,
      workingDirectory: dirValidation.effectiveDir
    });
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', 
        text: `Enhanced AST-grep search for pattern: "${pattern}"\nLanguage: ${language || 'auto-detect'}\nFormat: ${result.format}\nFound ${result.totalMatches} match(es)` });
      
      if (result.results.length === 0) {
        outputLines.push({ type: 'text', text: 'No matches found.' });
      } else {
        result.results.forEach((match, index) => {
          const metaVars = match.metaVariables?.single ? 
            Object.entries(match.metaVariables.single).map(([key, val]) => `${key}: ${val.text || val}`).join(', ') : 'none';
          
          let matchText = `[${index + 1}] ${match.file}:${match.startLine}-${match.endLine}`;
          if (match.startColumn !== undefined) {
            matchText += ` (col ${match.startColumn}-${match.endColumn})`;
          }
          matchText += `\nMeta variables: ${metaVars}`;
          
          if (match.metadata) {
            matchText += `\nMetadata: strategy=${match.metadata.matchStrategy}, complexity=${match.metadata.patternComplexity?.complexity || 'N/A'}`;
          }
          
          matchText += `\nCode:\n${match.text}`;
          outputLines.push({ type: 'text', text: matchText });
        });
      }
      
      if (result.searchMetadata) {
        outputLines.push({ type: 'text', 
          text: `Performance: ${result.searchMetadata.performance.matchesPerSecond} matches/sec` });
      }
      
      outputLines.push({ type: 'text', text: `Search completed in ${result.executionTimeMs}ms` });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepMultiPatternSearch = async (args, defaultWorkingDir, getAdvancedUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { patterns, language, paths, operator, context, strictness, includeMetadata } = args;
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    return { content: [{ type: 'text', text: 'ERROR: Missing patterns array for multi-pattern search' }] };
  }
  
  try {
    const { multiPatternSearch } = await getAdvancedUtils();
    const result = await multiPatternSearch(patterns, {
      language,
      paths,
      operator: operator || 'any',
      context,
      strictness,
      includeMetadata: includeMetadata !== false,
      workingDirectory: dirValidation.effectiveDir
    });
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', 
        text: `Multi-pattern search (${result.operator} operation)\nPatterns: ${patterns.length}\nCombined matches: ${result.totalCombinedMatches}` });
      
      // Show results per pattern
      result.patternResults.forEach((patternResult, index) => {
        outputLines.push({ type: 'text', 
          text: `Pattern ${index + 1}: "${patternResult.pattern}" - ${patternResult.matchCount} matches` });
      });
      
      // Show combined results
      if (result.combinedMatches.length === 0) {
        outputLines.push({ type: 'text', text: 'No combined matches found.' });
      } else {
        outputLines.push({ type: 'text', text: '\nCombined Results:' });
        result.combinedMatches.slice(0, 10).forEach((match, index) => { // Limit to first 10
          outputLines.push({ type: 'text', 
            text: `[${index + 1}] ${match.file}:${match.startLine}-${match.endLine} (pattern: "${match.pattern}")` });
        });
        
        if (result.combinedMatches.length > 10) {
          outputLines.push({ type: 'text', text: `... and ${result.combinedMatches.length - 10} more matches` });
        }
      }
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepConstraintSearch = async (args, defaultWorkingDir, getAdvancedUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { pattern, constraints, language, paths, context, strictness } = args;
  if (!pattern) {
    return { content: [{ type: 'text', text: 'ERROR: Missing pattern argument for constraint-based search' }] };
  }
  
  try {
    const { constraintBasedSearch } = await getAdvancedUtils();
    const result = await constraintBasedSearch(pattern, constraints || {}, {
      language,
      paths,
      context,
      strictness,
      workingDirectory: dirValidation.effectiveDir
    });
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', 
        text: `Constraint-based search for pattern: "${pattern}"\nMatches: ${result.totalMatches}` });
      
      if (Object.keys(result.constraintsApplied).length > 0) {
        const appliedConstraints = Object.entries(result.constraintsApplied)
          .filter(([, value]) => value)
          .map(([key]) => key);
        outputLines.push({ type: 'text', text: `Constraints applied: ${appliedConstraints.join(', ')}` });
      }
      
      if (result.matches.length === 0) {
        outputLines.push({ type: 'text', text: 'No matches found that meet the constraints.' });
      } else {
        result.matches.forEach((match, index) => {
          outputLines.push({ type: 'text', 
            text: `[${index + 1}] ${match.file}:${match.startLine}-${match.endLine}\nCode:\n${match.text}` });
        });
      }
      
      outputLines.push({ type: 'text', text: `Search completed in ${result.executionTimeMs}ms` });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepProjectInit = async (args, defaultWorkingDir, getProjectUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { projectType, includeTests, createRules, ruleCategories } = args;
  
  try {
    const { astgrepProjectInit } = await getProjectUtils();
    const result = await astgrepProjectInit({
      workingDirectory: dirValidation.effectiveDir,
      projectType: projectType || 'javascript',
      includeTests: includeTests !== false,
      createRules: createRules !== false,
      ruleCategories: ruleCategories || ['security', 'performance', 'style']
    });
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', text: result.message });
      outputLines.push({ type: 'text', text: `Configuration file: ${result.configPath}` });
      
      if (result.rulesCreated.length > 0) {
        outputLines.push({ type: 'text', text: `Rules created:` });
        result.rulesCreated.forEach(rulePath => {
          outputLines.push({ type: 'text', text: `  - ${rulePath}` });
        });
      }
      
      outputLines.push({ type: 'text', text: 'Project initialization complete!' });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepProjectScan = async (args, defaultWorkingDir, getProjectUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { scanType, outputFormat, includeMetrics } = args;
  
  try {
    const { astgrepProjectScan } = await getProjectUtils();
    const result = await astgrepProjectScan({
      workingDirectory: dirValidation.effectiveDir,
      scanType: scanType || 'comprehensive',
      outputFormat: outputFormat || 'summary',
      includeMetrics: includeMetrics !== false
    });
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', 
        text: `Project scan (${result.scanType})\nConfiguration: ${result.hasConfiguration ? 'Found' : 'Not found'}` });
      
      if (result.results.totalFiles !== undefined) {
        outputLines.push({ type: 'text', text: `Files scanned: ${result.results.totalFiles}` });
      }
      
      if (result.results.totalIssues !== undefined) {
        outputLines.push({ type: 'text', text: `Issues found: ${result.results.totalIssues}` });
      }
      
      // Show issues by type/severity
      if (result.results.issuesByType) {
        outputLines.push({ type: 'text', text: '\nIssues by type:' });
        Object.entries(result.results.issuesByType).forEach(([type, count]) => {
          outputLines.push({ type: 'text', text: `  ${type}: ${count}` });
        });
      }
      
      if (result.results.issuesBySeverity) {
        outputLines.push({ type: 'text', text: '\nIssues by severity:' });
        Object.entries(result.results.issuesBySeverity).forEach(([severity, count]) => {
          outputLines.push({ type: 'text', text: `  ${severity}: ${count}` });
        });
      }
      
      if (result.metrics) {
        outputLines.push({ type: 'text', 
          text: `\nPerformance: ${result.metrics.performance.filesPerSecond} files/sec, ${result.executionTimeMs}ms total` });
      }
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepTest = async (args, defaultWorkingDir, getTestUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { rulesPath, rules, testCases, createTestSuite, outputFormat } = args;
  
  try {
    const { astgrepTestRules } = await getTestUtils();
    const result = await astgrepTestRules({
      rulesPath,
      rules,
      testCases: testCases || [],
      createTestSuite: createTestSuite !== false,
      outputFormat: outputFormat || 'detailed',
      workingDirectory: dirValidation.effectiveDir
    });
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', 
        text: `Rule testing completed\nTotal tests: ${result.summary.total}` });
      
      outputLines.push({ type: 'text', 
        text: `Results: ${result.summary.passed} passed, ${result.summary.failed} failed (${result.summary.successRate}% success rate)` });
      
      if (result.summary.averageExecutionTime) {
        outputLines.push({ type: 'text', 
          text: `Average execution time: ${result.summary.averageExecutionTime}ms` });
      }
      
      if (result.summary.failedTests.length > 0) {
        outputLines.push({ type: 'text', text: '\nFailed tests:' });
        result.summary.failedTests.forEach(test => {
          let failureText = `  - ${test.name}`;
          if (test.error) {
            failureText += `: ${test.error}`;
          } else if (test.failure) {
            failureText += `: ${test.failure.details}`;
          }
          outputLines.push({ type: 'text', text: failureText });
        });
      }
      
      outputLines.push({ type: 'text', text: `\nTotal execution time: ${result.executionTimeMs}ms` });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepValidateRules = async (args, defaultWorkingDir, getTestUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { rules, validateSyntax, validateLogic, validatePerformance, performanceThreshold } = args;
  if (!rules) {
    return { content: [{ type: 'text', text: 'ERROR: Missing rules argument for rule validation' }] };
  }
  
  try {
    const { astgrepValidateRules } = await getTestUtils();
    const result = await astgrepValidateRules(rules, {
      validateSyntax: validateSyntax !== false,
      validateLogic: validateLogic !== false,
      validatePerformance: validatePerformance !== false,
      performanceThreshold: performanceThreshold || 5000,
      workingDirectory: dirValidation.effectiveDir
    });
    
    const outputLines = [];
    if (result.success) {
      const validation = result.validation;
      outputLines.push({ type: 'text', 
        text: `Rule validation ${validation.overallValid ? 'PASSED' : 'FAILED'}` });
      
      if (validation.syntaxValidation) {
        outputLines.push({ type: 'text', 
          text: `Syntax validation: ${validation.syntaxValidation.valid ? 'PASSED' : 'FAILED'}` });
      }
      
      if (validation.logicValidation) {
        outputLines.push({ type: 'text', 
          text: `Logic validation: ${validation.logicValidation.valid ? 'PASSED' : 'FAILED'}` });
      }
      
      if (validation.performanceValidation) {
        outputLines.push({ type: 'text', 
          text: `Performance: ${validation.performanceValidation.executionTimeMs}ms (threshold: ${validation.performanceValidation.threshold}ms)` });
      }
      
      if (validation.errors.length > 0) {
        outputLines.push({ type: 'text', text: '\nErrors:' });
        validation.errors.forEach(error => {
          outputLines.push({ type: 'text', text: `  - ${error}` });
        });
      }
      
      if (validation.warnings.length > 0) {
        outputLines.push({ type: 'text', text: '\nWarnings:' });
        validation.warnings.forEach(warning => {
          outputLines.push({ type: 'text', text: `  - ${warning}` });
        });
      }
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepDebugRule = async (args, defaultWorkingDir, getTestUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { ruleId, rulesPath, testCode, language, verboseOutput } = args;
  if (!ruleId) {
    return { content: [{ type: 'text', text: 'ERROR: Missing ruleId argument for rule debugging' }] };
  }
  
  try {
    const { astgrepDebugRule } = await getTestUtils();
    const result = await astgrepDebugRule(ruleId, {
      rulesPath,
      testCode,
      language: language || 'javascript',
      verboseOutput: verboseOutput !== false,
      workingDirectory: dirValidation.effectiveDir
    });
    
    const outputLines = [];
    if (result.success) {
      const debug = result.debugInfo;
      outputLines.push({ type: 'text', 
        text: `Debug rule: "${debug.ruleId}"\nExecution: ${debug.success ? 'SUCCESS' : 'FAILED'}\nTime: ${debug.executionTimeMs}ms` });
      
      if (debug.success) {
        outputLines.push({ type: 'text', text: `Matches found: ${debug.matchCount}` });
        
        if (debug.matches && debug.matches.length > 0) {
          debug.matches.slice(0, 3).forEach((match, index) => { // Show first 3 matches
            outputLines.push({ type: 'text', 
              text: `[${index + 1}] ${match.file || 'test'}:${match.range?.start?.line || 0}` });
          });
        }
      } else {
        outputLines.push({ type: 'text', text: `Error: ${debug.error}` });
      }
      
      if (debug.debugOutput && verboseOutput) {
        outputLines.push({ type: 'text', text: `\nDebug output:\n${debug.debugOutput}` });
      }
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};