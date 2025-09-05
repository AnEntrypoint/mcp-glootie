import { spawn } from 'child_process';
import * as path from 'node:path';
import { writeFileSync, readFileSync, existsSync } from 'fs';

/**
 * Project configuration management for ast-grep
 * Handles project initialization and scanning operations
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
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
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

export const astgrepProjectInit = async (options = {}) => {
  const {
    workingDirectory,
    projectType = 'javascript', // javascript, typescript, python, rust, go
    includeTests = true,
    createRules = true,
    ruleCategories = ['security', 'performance', 'style']
  } = options;

  const configPath = path.join(workingDirectory, 'sgconfig.yml');
  const rulesDir = path.join(workingDirectory, '.ast-grep', 'rules');
  
  try {
    // Generate project-specific configuration
    const config = generateProjectConfig(projectType, includeTests);
    
    // Create configuration file
    writeFileSync(configPath, config, 'utf8');
    
    let createdRules = [];
    if (createRules) {
      // Create rules directory structure
      const { mkdirSync } = await import('fs');
      mkdirSync(path.dirname(path.join(rulesDir, 'temp')), { recursive: true });
      
      // Generate category-specific rule files
      for (const category of ruleCategories) {
        const rules = generateCategoryRules(projectType, category);
        const rulePath = path.join(rulesDir, `${category}.yml`);
        writeFileSync(rulePath, rules, 'utf8');
        createdRules.push(rulePath);
      }
    }
    
    return {
      success: true,
      configPath,
      rulesCreated: createdRules,
      projectType,
      message: `Initialized ast-grep project for ${projectType}`,
      files: {
        config: configPath,
        rules: createdRules
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export const astgrepProjectScan = async (options = {}) => {
  const {
    workingDirectory,
    scanType = 'comprehensive', // 'quick', 'comprehensive', 'security'
    outputFormat = 'summary',
    includeMetrics = true
  } = options;

  const startTime = Date.now();
  
  try {
    // Check if project has ast-grep configuration
    const configPath = path.join(workingDirectory, 'sgconfig.yml');
    const hasConfig = existsSync(configPath);
    
    // Perform different scan types
    let scanResults = {};
    
    switch (scanType) {
      case 'quick':
        scanResults = await performQuickScan(workingDirectory);
        break;
      case 'comprehensive':
        scanResults = await performComprehensiveScan(workingDirectory);
        break;
      case 'security':
        scanResults = await performSecurityScan(workingDirectory);
        break;
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    return {
      success: true,
      scanType,
      hasConfiguration: hasConfig,
      results: scanResults,
      executionTimeMs,
      ...(includeMetrics && {
        metrics: {
          filesScanned: scanResults.totalFiles || 0,
          issuesFound: scanResults.totalIssues || 0,
          performance: {
            filesPerSecond: Math.round((scanResults.totalFiles || 0) / (executionTimeMs / 1000)),
            executionTimeMs
          }
        }
      })
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTimeMs: Date.now() - startTime
    };
  }
};

const generateProjectConfig = (projectType, includeTests) => {
  const baseConfig = {
    javascript: {
      ruleDirs: [".ast-grep/rules"],
      testDirs: includeTests ? ["test", "tests", "__tests__", "spec"] : [],
      languageGlobs: {
        javascript: ["**/*.js", "**/*.jsx", "**/*.mjs"],
        typescript: ["**/*.ts", "**/*.tsx"]
      }
    },
    typescript: {
      ruleDirs: [".ast-grep/rules"],
      testDirs: includeTests ? ["test", "tests", "__tests__", "spec"] : [],
      languageGlobs: {
        typescript: ["**/*.ts", "**/*.tsx"],
        javascript: ["**/*.js", "**/*.jsx"]
      }
    },
    python: {
      ruleDirs: [".ast-grep/rules"],
      testDirs: includeTests ? ["test", "tests", "test_*"] : [],
      languageGlobs: {
        python: ["**/*.py"]
      }
    }
  };

  const config = baseConfig[projectType] || baseConfig.javascript;
  
  return `# ast-grep project configuration
# Generated for ${projectType} project

ruleDirs:
${config.ruleDirs.map(dir => `  - "${dir}"`).join('\n')}

${config.testDirs.length > 0 ? `testDirs:
${config.testDirs.map(dir => `  - "${dir}"`).join('\n')}` : ''}

languageGlobs:
${Object.entries(config.languageGlobs).map(([lang, globs]) => 
  `  ${lang}:\n${globs.map(glob => `    - "${glob}"`).join('\n')}`
).join('\n')}

# Ignore patterns
ignore:
  - "node_modules/**"
  - "dist/**"
  - "build/**"
  - ".git/**"
  - "*.min.js"
`;
};

const generateCategoryRules = (projectType, category) => {
  const ruleTemplates = {
    security: {
      javascript: `# Security rules for JavaScript/TypeScript
rules:
  - id: no-eval
    message: "Avoid using eval() - security risk"
    rule:
      pattern: eval($EXPR)
    severity: error
    
  - id: no-inner-html
    message: "innerHTML assignment may lead to XSS"
    rule:
      pattern: $OBJ.innerHTML = $UNSAFE
    severity: warning
    
  - id: no-exec-without-validation
    message: "exec() usage without input validation"
    rule:
      pattern: $$.exec($INPUT)
    severity: error`,
      python: `# Security rules for Python
rules:
  - id: no-exec
    message: "Avoid using exec() - security risk"
    rule:
      pattern: exec($EXPR)
    severity: error
    
  - id: no-eval
    message: "Avoid using eval() - security risk" 
    rule:
      pattern: eval($EXPR)
    severity: error`
    },
    performance: {
      javascript: `# Performance rules for JavaScript/TypeScript
rules:
  - id: avoid-sync-fs
    message: "Avoid synchronous filesystem operations"
    rule:
      any:
        - pattern: fs.readFileSync($$$)
        - pattern: fs.writeFileSync($$$)
    severity: warning
    
  - id: missing-await
    message: "Async function without await may indicate missing await"
    rule:
      pattern: async function $NAME($$$) { return $SYNC_VALUE }
    severity: info`,
      python: `# Performance rules for Python  
rules:
  - id: avoid-string-concat-loop
    message: "String concatenation in loop is inefficient"
    rule:
      pattern: |
        for $VAR in $ITERABLE:
            $STR += $EXPR
    severity: warning`
    },
    style: {
      javascript: `# Style rules for JavaScript/TypeScript
rules:
  - id: prefer-const
    message: "Use const for variables that are never reassigned"
    rule:
      pattern: let $VAR = $VALUE
    severity: hint
    
  - id: no-console-log
    message: "Remove console.log statements"
    rule:
      pattern: console.log($$$)
    severity: info`,
      python: `# Style rules for Python
rules:
  - id: snake-case-functions
    message: "Use snake_case for function names"
    rule:
      pattern: def $CAMELCASE($$$):
      where:
        $CAMELCASE:
          regex: "^[a-z]+[A-Z].*"
    severity: hint`
    }
  };

  const templates = ruleTemplates[category];
  return templates?.[projectType] || templates?.javascript || `# ${category} rules\nrules: []`;
};

const performQuickScan = async (workingDirectory) => {
  // Quick scan focuses on common issues
  const commonIssues = [
    { pattern: 'console.log($$$)', message: 'Debug statements found' },
    { pattern: 'eval($$$)', message: 'Security risk: eval usage' },
    { pattern: '$$.innerHTML = $UNSAFE', message: 'Potential XSS risk' }
  ];

  let totalFiles = 0;
  let totalIssues = 0;
  const issuesByType = {};

  for (const issue of commonIssues) {
    const args = ['run', '--json=compact', '--pattern', issue.pattern, '.'];
    const result = await executeAstGrepCommand(args, workingDirectory);
    
    if (result.success && result.stdout) {
      try {
        const matches = JSON.parse(result.stdout);
        if (Array.isArray(matches)) {
          totalIssues += matches.length;
          issuesByType[issue.message] = matches.length;
          totalFiles += new Set(matches.map(m => m.file)).size;
        }
      } catch (e) {
        // Ignore parse errors in quick scan
      }
    }
  }

  return {
    totalFiles,
    totalIssues,
    issuesByType,
    scanType: 'quick'
  };
};

const performComprehensiveScan = async (workingDirectory) => {
  // Check if custom rules exist
  const rulesDir = path.join(workingDirectory, '.ast-grep', 'rules');
  const hasCustomRules = existsSync(rulesDir);
  
  let results = {
    totalFiles: 0,
    totalIssues: 0,
    ruleCategories: {},
    hasCustomRules,
    scanType: 'comprehensive'
  };

  if (hasCustomRules) {
    // Scan using custom rules
    const args = ['scan', '--json', '.'];
    const result = await executeAstGrepCommand(args, workingDirectory);
    
    if (result.success && result.stdout) {
      try {
        const scanResults = JSON.parse(result.stdout);
        results.totalIssues = scanResults.length || 0;
        results.totalFiles = new Set((scanResults || []).map(r => r.file)).size;
      } catch (e) {
        // Fallback to pattern-based scan
        results = await performQuickScan(workingDirectory);
      }
    }
  } else {
    // Fallback to quick scan
    results = await performQuickScan(workingDirectory);
  }

  return results;
};

const performSecurityScan = async (workingDirectory) => {
  const securityPatterns = [
    { pattern: 'eval($$$)', severity: 'high', message: 'Code injection risk: eval usage' },
    { pattern: 'new Function($$$)', severity: 'high', message: 'Code injection risk: Function constructor' },
    { pattern: '$$.innerHTML = $UNSAFE', severity: 'medium', message: 'XSS risk: innerHTML assignment' },
    { pattern: '$$.exec($INPUT)', severity: 'medium', message: 'Command injection risk: exec usage' },
    { pattern: 'document.write($$$)', severity: 'medium', message: 'XSS risk: document.write' }
  ];

  let totalFiles = 0;
  let totalIssues = 0;
  const issuesBySeverity = { high: 0, medium: 0, low: 0 };
  const detailedFindings = [];

  for (const pattern of securityPatterns) {
    const args = ['run', '--json=compact', '--pattern', pattern.pattern, '.'];
    const result = await executeAstGrepCommand(args, workingDirectory);
    
    if (result.success && result.stdout) {
      try {
        const matches = JSON.parse(result.stdout);
        if (Array.isArray(matches)) {
          totalIssues += matches.length;
          issuesBySeverity[pattern.severity] += matches.length;
          totalFiles += new Set(matches.map(m => m.file)).size;
          
          detailedFindings.push({
            pattern: pattern.pattern,
            severity: pattern.severity,
            message: pattern.message,
            occurrences: matches.length,
            files: [...new Set(matches.map(m => m.file))]
          });
        }
      } catch (e) {
        // Continue with other patterns
      }
    }
  }

  return {
    totalFiles,
    totalIssues,
    issuesBySeverity,
    detailedFindings,
    scanType: 'security'
  };
};