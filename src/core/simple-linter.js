import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
// Context functionality moved to hooks

// Common linting rules for different languages
const DEFAULT_LINTING_RULES = {
  javascript: [
    {
      id: 'no-console',
      pattern: 'console.log($$$)',
      message: 'Avoid using console.log in production code',
      severity: 'warning'
    },
    {
      id: 'no-debugger',
      pattern: 'debugger',
      message: 'Remove debugger statements',
      severity: 'error'
    },
    {
      id: 'no-var',
      pattern: 'var $$$',
      message: 'Use let or const instead of var',
      severity: 'warning'
    },
    {
      id: 'prefer-const',
      pattern: 'let $A = $$$',
      constraints: { 'A': { regex: '^[A-Z_][A-Z0-9_]*$' } },
      message: 'Use const for constants (uppercase variables)',
      severity: 'warning'
    }
  ],
  typescript: [
    {
      id: 'no-any',
      pattern: ': any',
      message: 'Avoid using any type',
      severity: 'warning'
    },
    {
      id: 'interface-naming',
      pattern: 'interface $A { $$$ }',
      constraints: { 'A': { regex: '^[a-z][a-zA-Z0-9]*$' } },
      message: 'Interface names should start with uppercase letter',
      severity: 'warning'
    }
  ],
  jsx: [
    {
      id: 'jsx-key',
      pattern: '<$ELEMENT $$$>',
      constraints: { 'ELEMENT': { regex: '^[a-z]' } },
      message: 'Missing key prop for list element',
      severity: 'warning'
    }
  ],
  python: [
    {
      id: 'no-print',
      pattern: 'print($$$)',
      message: 'Avoid using print in production code',
      severity: 'warning'
    },
    {
      id: 'import-style',
      pattern: 'from $$$ import *',
      message: 'Avoid wildcard imports',
      severity: 'warning'
    }
  ]
};

// Simple linter using string patterns and regex
export class SimpleLinter {
  constructor(language = 'javascript') {
    this.language = language;
    this.rules = this.getRulesForLanguage(language);
  }

  getRulesForLanguage(language) {
    // Map file extensions to languages
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.py': 'python',
      '.mjs': 'javascript',
      '.cjs': 'javascript'
    };

    const effectiveLanguage = languageMap[language] || language;
    return DEFAULT_LINTING_RULES[effectiveLanguage] || DEFAULT_LINTING_RULES.javascript;
  }

  lint(content, filePath = '') {
    const results = [];
    const lines = content.split('\n');

    for (const rule of this.rules) {
      let regex;

      // Convert ast-grep like pattern to regex
      if (rule.pattern.includes('$$$')) {
        // Simple pattern matching for $$$ placeholders
        let pattern = rule.pattern
          .replace(/\$/g, '\\$')
          .replace(/\$\$\$/g, '.*?');
        // Remove variable captures for simplicity
        pattern = pattern.replace(/\$[A-Z]+/g, '.*?');
        regex = new RegExp(pattern, 'g');
      } else {
        regex = new RegExp(rule.pattern, 'g');
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        while ((match = regex.exec(line)) !== null) {
          const column = match.index + 1;

          // Check constraints if any
          let constraintMatch = true;
          if (rule.constraints) {
            // For now, skip complex constraint checking with unnamed groups
            // This is a simplified implementation
          }

          if (constraintMatch) {
            results.push({
              ruleId: rule.id,
              message: rule.message,
              severity: rule.severity || 'warning',
              line: i + 1,
              column,
              lineContent: line.trim(),
              filePath
            });
          }
        }
      }
    }

    return {
      results,
      summary: {
        total: results.length,
        errors: results.filter(r => r.severity === 'error').length,
        warnings: results.filter(r => r.severity === 'warning').length,
        info: results.filter(r => r.severity === 'info').length
      }
    };
  }
}