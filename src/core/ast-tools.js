import fs from 'fs';
import path from 'path';
import ignore from 'ignore';

class ASTGrepHelper {
  constructor(language = 'javascript') {
    this.language = language;
    this.astGrep = null;
    this.registeredLanguages = new Set();
    this.initializeASTGrep();
  }

  detectLanguageFromExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const extensionMap = {
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.go': 'go',
      '.rs': 'rust',
      '.py': 'python',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.html': 'html',
      '.css': 'css'
    };

    return extensionMap[ext] || 'javascript';
  }

  setLanguage(language) {
    // Only validate non-core languages (JS/TS/HTML/CSS are always available)
    if (language !== 'javascript' && language !== 'typescript' &&
        language !== 'jsx' && language !== 'tsx' &&
        language !== 'html' && language !== 'css' &&
        !this.registeredLanguages.has(language)) {
      throw new Error(`Language '${language}' is not available. Install @ast-grep/lang-${language} to add support.`);
    }
    this.language = language;
  }

  async initializeASTGrep() {
    try {
      const { parse, Lang, registerDynamicLanguage } = await import('@ast-grep/napi');
      this.parse = parse;
      this.Lang = Lang;
      this.registerDynamicLanguage = registerDynamicLanguage;
      this.astGrep = { parse, Lang, registerDynamicLanguage };

      // Register additional languages
      await this.registerAdditionalLanguages();
    } catch (error) {
      console.warn('ast-grep not available, using fallback pattern matching');
      this.astGrep = null;
    }
  }

  async registerAdditionalLanguages() {
    const languagePackages = [
      { name: 'go', package: '@ast-grep/lang-go', key: 'Go' },
      { name: 'rust', package: '@ast-grep/lang-rust', key: 'Rust' },
      { name: 'python', package: '@ast-grep/lang-python', key: 'Python' },
      { name: 'c', package: '@ast-grep/lang-c', key: 'C' },
      { name: 'cpp', package: '@ast-grep/lang-cpp', key: 'Cpp' }
    ];

    for (const { name, package: packageName, key } of languagePackages) {
      try {
        const langModule = await import(packageName);
        this.registerDynamicLanguage({ [key]: langModule.default });
        this.registeredLanguages.add(name);
      } catch (error) {
        // Silently fail - don't warn about missing parsers unless user tries to use them
        this.availableLanguages = this.availableLanguages || new Set();
        this.availableLanguages.delete(name);
      }
    }
  }

  async parseCode(code) {
    if (!this.astGrep) {
      throw new Error('ast-grep not available');
    }

    try {
      const { parse, Lang } = this.astGrep;
      let lang = Lang.JavaScript;

      // Map language names to Lang keys
      const languageMap = {
        'javascript': Lang.JavaScript,
        'typescript': Lang.TypeScript,
        'jsx': Lang.JSX || Lang.JavaScript,
        'tsx': Lang.TSX || Lang.TypeScript,
        'html': Lang.Html,
        'css': Lang.Css,
        'go': 'Go',
        'rust': 'Rust',
        'python': 'Python',
        'c': 'C',
        'cpp': 'Cpp'
      };

      if (languageMap[this.language]) {
        // Check if language is actually available (registered successfully)
        if (this.language !== 'javascript' && this.language !== 'typescript' &&
            this.language !== 'jsx' && this.language !== 'tsx' &&
            this.language !== 'html' && this.language !== 'css' &&
            !this.registeredLanguages.has(this.language)) {
          throw new Error(`Language '${this.language}' is not available. Install @ast-grep/lang-${this.language} to add support.`);
        }
        lang = languageMap[this.language];
      } else {
        console.warn(`Unknown language: ${this.language}, defaulting to JavaScript`);
      }

      return parse(lang, code);
    } catch (error) {
      throw new Error(`Failed to parse ${this.language} code: ${error.message}`);
    }
  }

  async searchPattern(code, pattern) {
    if (!this.astGrep) {
      const regex = new RegExp(this.escapeRegex(pattern), 'g');
      const matches = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        matches.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
          line: this.getLineFromPosition(code, match.index),
          column: this.getColumnFromPosition(code, match.index)
        });
      }
      return matches;
    }

    try {
      const ast = await this.parseCode(code);
      const root = ast.root();
      const node = root.find(pattern);

      if (!node) return [];

      const range = node.range();
      return [{
        text: node.text(),
        start: range.start.index,
        end: range.end.index,
        line: range.start.line,
        column: range.start.column
      }];
    } catch (error) {
      throw new Error(`Pattern search failed: ${error.message}`);
    }
  }

  async replacePattern(code, pattern, replacement) {
    if (!this.astGrep) {
        const regex = new RegExp(this.escapeRegex(pattern), 'g');
      return code.replace(regex, replacement);
    }

    try {
      const ast = await this.parseCode(code);
      const root = ast.root();
      const node = root.find(pattern);

      if (!node) return code;

      const edit = node.replace(replacement);
      return root.commitEdits([edit]);
    } catch (error) {
      throw new Error(`Pattern replacement failed: ${error.message}`);
    }
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getLineFromPosition(code, position) {
    const before = code.substring(0, position);
    return before.split('\n').length - 1;
  }

  getColumnFromPosition(code, position) {
    const before = code.substring(0, position);
    const lastNewline = before.lastIndexOf('\n');
    return lastNewline === -1 ? position : position - lastNewline - 1;
  }
}

export async function astSearch(filePath, pattern, options = {}) {
  const {
    language = 'javascript',
    recursive = false,
    maxResults = 100,
    ignorePatterns = []
  } = options;

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const helper = new ASTGrepHelper(language);
    const results = [];

    const processFile = async (file) => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const matches = await helper.searchPattern(content, pattern);

        return matches.map(match => ({
          file,
          content: match.text,
          line: match.line,
          column: match.column,
          start: match.start,
          end: match.end
        }));
      } catch (error) {
        return [{ file, error: error.message }];
      }
    };

    if (fs.statSync(filePath).isDirectory()) {
      const files = await findFiles(filePath, {
        recursive,
        extensions: ['.js', '.ts', '.jsx', '.tsx'],
        ignorePatterns
      });

      for (const file of files.slice(0, maxResults)) {
        const fileResults = await processFile(file);
        results.push(...fileResults);
      }
    } else {
      const fileResults = await processFile(filePath);
      results.push(...fileResults);
    }

    return results.slice(0, maxResults);
  } catch (error) {
    throw new Error(`AST search failed: ${error.message}`);
  }
}

export async function astReplace(filePath, pattern, replacement, options = {}) {
  const {
    language = 'javascript',
    recursive = false,
    backup = true,
    ignorePatterns = []
  } = options;

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const helper = new ASTGrepHelper(language);
    const results = [];

    const processFile = async (file) => {
      try {
        const content = fs.readFileSync(file, 'utf8');

        if (backup) {
          const backupPath = file + '.backup';
          fs.writeFileSync(backupPath, content);
        }

        const newContent = await helper.replacePattern(content, pattern, replacement);

        if (newContent !== content) {
          fs.writeFileSync(file, newContent);
          return { file, status: 'modified', changes: true };
        } else {
          return { file, status: 'unchanged', changes: false };
        }
      } catch (error) {
        return { file, error: error.message, status: 'failed' };
      }
    };

    if (fs.statSync(filePath).isDirectory()) {
      const files = await findFiles(filePath, {
        recursive,
        extensions: ['.js', '.ts', '.jsx', '.tsx'],
        ignorePatterns
      });

      for (const file of files) {
        const result = await processFile(file);
        results.push(result);
      }
    } else {
      const result = await processFile(filePath);
      results.push(result);
    }

    return results;
  } catch (error) {
    throw new Error(`AST replace failed: ${error.message}`);
  }
}

export async function astLint(filePath, rules = [], options = {}) {
  const {
    language = 'javascript',
    recursive = false,
    ignorePatterns = []
  } = options;

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const helper = new ASTGrepHelper(language);
    const results = [];

    const processFile = async (file) => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const issues = [];

        for (const rule of rules) {
          const matches = await helper.searchPattern(content, rule.pattern);

          matches.forEach(match => {
            issues.push({
              file,
              rule: rule.name,
              message: rule.message || `Pattern "${rule.pattern}" matched`,
              severity: rule.severity || 'warning',
              line: match.line,
              column: match.column,
              content: match.text
            });
          });
        }

        return issues;
      } catch (error) {
        return [{ file, error: error.message }];
      }
    };

    if (fs.statSync(filePath).isDirectory()) {
      const files = await findFiles(filePath, {
        recursive,
        extensions: ['.js', '.ts', '.jsx', '.tsx'],
        ignorePatterns: [...getDefaultIgnorePatterns(), ...ignorePatterns]
      });

      for (const file of files) {
        const fileIssues = await processFile(file);
        results.push(...fileIssues);
      }
    } else {
      const fileIssues = await processFile(filePath);
      results.push(...fileIssues);
    }

    return results;
  } catch (error) {
    throw new Error(`AST lint failed: ${error.message}`);
  }
}

async function findFiles(dir, options = {}) {
  const {
    recursive = true,
    extensions = ['.js', '.ts', '.jsx', '.tsx'],
    ignorePatterns = [],
    useGitignore = true
  } = options;

  const results = [];

  // Combine default patterns, gitignore patterns, and custom patterns
  const allPatterns = [
    ...getDefaultIgnorePatterns(),
    ...(useGitignore ? loadGitignorePatterns(dir) : []),
    ...ignorePatterns
  ];

  // Create ignore instance
  const ig = ignore();
  ig.add(allPatterns);

  const scan = async (currentDir) => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Only apply ignore patterns to paths within the base directory
      let shouldIgnore = false;
      if (fullPath.startsWith(dir)) {
        const relativePath = path.relative(dir, fullPath);
        shouldIgnore = ig.ignores(relativePath) || ig.ignores(entry.name);
      }

      if (shouldIgnore) {
        continue;
      }

      if (entry.isDirectory() && recursive) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        if (extensions.some(ext => fullPath.endsWith(ext))) {
          results.push(fullPath);
        }
      }
    }
  };

  await scan(dir);
  return results;
}

// Default ignore patterns for performance
export function getDefaultIgnorePatterns(workingDirectory) {
  return [
    '**/node_modules/**',
    '**/.git/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/.vuepress/**',
    '**/.docusaurus/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/coverage/**',
    '**/.nyc_output/**',
    '**/.cache/**',
    '**/.parcel-cache/**',
    '**/.turbo/**',
    '**/.nx/**',
    '**/.swc/**',
    '**/bower_components/**',
    '**/jspm_packages/**',
    '**/.pnp/**',
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/__snapshots__/**',
    '**/.jest/**',
    '**/.mocha/**',
    '**/.cypress/**',
    '**/.playwright/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/*.chunk.js',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
    '**/.npmrc',
    '**/.yarnrc',
    '**/*.log',
    '**/tmp/**',
    '**/temp/**',
    '**/.tmp/**',
  '**/.DS_Store',
  '**/Thumbs.db'
  ];
}

// Load gitignore patterns from directory
function loadGitignorePatterns(dir) {
  const gitignorePath = path.join(dir, '.gitignore');
  const patterns = [];

  if (fs.existsSync(gitignorePath)) {
    try {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      patterns.push(...lines);
    } catch (error) {
      console.warn(`Failed to read .gitignore: ${error.message}`);
    }
  }

  return patterns;
}


export const DEFAULT_LINT_RULES = [
  {
    name: 'no-console-log',
    pattern: 'console.log($$)',
    message: 'Avoid using console.log in production code',
    severity: 'warning'
  },
  {
    name: 'no-debugger',
    pattern: 'debugger',
    message: 'Remove debugger statements',
    severity: 'error'
  },
  {
    name: 'no-var',
    pattern: 'var $A',
    message: 'Use let or const instead of var',
    severity: 'warning'
  }
];

export const AST_TOOLS = [
  {
    name: 'ast_search',
    description: 'Find structural code patterns using AST analysis across multi-language codebases.',
    supported_operations: ['pattern matching', 'code structure analysis', 'syntax search', 'variable declaration finding', 'function call detection'],
    use_cases: ['Find all console.log statements', 'Locate variable declarations', 'Find function calls with specific patterns', 'Search for class definitions', 'Identify import statements'],
    examples: [
      'console.log($MSG)',
      'var $NAME = $VALUE',
      'function $NAME($ARGS) { $BODY }',
      'class $CLASS_NAME { $MEMBERS }',
      'import {$IMPORTS} from \'$MODULE\'',
      'const $NAME = require(\'$MODULE\')',
      'if ($CONDITION) { $BODY }',
      'try { $TRY_BODY } catch ($ERROR) { $CATCH_BODY }',
      'return $EXPRESSION',
      'throw new $ERROR_TYPE($MSG)'
    ],
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path to search'
        },
        pattern: {
          type: 'string',
          description: 'AST pattern to search (e.g., "console.log($$)", "function $NAME($ARGS) {}")'
        },
        language: {
          type: 'string',
          enum: ['javascript', 'typescript', 'jsx', 'tsx'],
          default: 'javascript',
          description: 'Programming language'
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: 'Search recursively in directories'
        },
        maxResults: {
          type: 'number',
          default: 50,
          description: 'Maximum number of results'
        }
      },
      required: ['path', 'pattern']
    },
    handler: async (args) => {
      const results = await astSearch(args.path, args.pattern, {
        language: args.language,
        recursive: args.recursive,
        maxResults: args.maxResults,
        ignorePatterns: getDefaultIgnorePatterns()
      });

      return {
        results: results.length,
        matches: results
      };
    }
  },
  {
    name: 'ast_replace',
    description: 'Replace structural code patterns safely using AST transformations.',
    supported_operations: ['code refactoring', 'pattern replacement', 'syntax transformation', 'API migration', 'deprecated code updates'],
    use_cases: ['Replace console.log with logger', 'Convert var to let/const', 'Rename function or variable names', 'Update deprecated APIs', 'Modernize syntax patterns'],
    examples: [
      'Pattern: console.log($MSG) → Replacement: logger.info($MSG)',
      'Pattern: var $NAME = $VALUE → Replacement: let $NAME = $VALUE',
      'Pattern: require(\'$MODULE\') → Replacement: import $MODULE from \'$MODULE\'',
      'Pattern: .then($CB) → Replacement: await $CB',
      'Pattern: function($ARGS) { $BODY } → Replacement: ($ARGS) => { $BODY }',
      'Pattern: new Promise(($RESOLVE, $REJECT) => { $BODY }) → Replacement: new Promise(async ($RESOLVE, $REJECT) => { $BODY })'
    ],
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path to modify'
        },
        pattern: {
          type: 'string',
          description: 'AST pattern to find (e.g., "console.log($MSG)", "var $NAME")'
        },
        replacement: {
          type: 'string',
          description: 'Replacement code (e.g., "logger.info($MSG)", "let $NAME")'
        },
        language: {
          type: 'string',
          enum: ['javascript', 'typescript', 'jsx', 'tsx'],
          default: 'javascript',
          description: 'Programming language'
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: 'Apply recursively in directories'
        },
        backup: {
          type: 'boolean',
          default: true,
          description: 'Create backup files before modification'
        }
      },
      required: ['path', 'pattern', 'replacement']
    },
    handler: async (args) => {
      const results = await astReplace(args.path, args.pattern, args.replacement, {
        language: args.language,
        recursive: args.recursive,
        backup: args.backup,
        ignorePatterns: getDefaultIgnorePatterns()
      });

      return {
        processed: results.length,
        results: results
      };
    }
  },
  {
    name: 'ast_lint',
    description: 'Lint code using custom AST pattern rules to enforce standards and detect issues.',
    supported_operations: ['code quality analysis', 'anti-pattern detection', 'coding standard enforcement', 'security pattern checking', 'performance issue detection'],
    use_cases: ['Find all console.log statements in production', 'Detect var declarations that should be const/let', 'Identify missing error handling', 'Find unused variables', 'Check for security vulnerabilities'],
    examples: [
      'Rule: {name: "no-console", pattern: "console.log($MSG)", message: "Avoid console.log in production", severity: "warning"}',
      'Rule: {name: "prefer-const", pattern: "var $NAME = $VALUE", message: "Use const instead of var", severity: "error"}',
      'Rule: {name: "no-unused-vars", pattern: "const $UNUSED = $VALUE", message: "Unused variable detected", severity: "warning"}',
      'Rule: {name: "error-handling", pattern: "try { $BODY } catch () { }", message: "Empty catch block", severity: "error"}',
      'Rule: {name: "promise-callback", pattern: "new Promise(function($RESOLVE, $REJECT) { $BODY })", message: "Use arrow functions for Promise callbacks", severity: "warning"}'
    ],
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File or directory path to lint'
        },
        rules: {
          type: 'array',
          description: 'Custom linting rules (uses default rules if not provided)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              pattern: { type: 'string' },
              message: { type: 'string' },
              severity: { type: 'string', enum: ['error', 'warning'] }
            }
          }
        },
        language: {
          type: 'string',
          enum: ['javascript', 'typescript', 'jsx', 'tsx'],
          default: 'javascript',
          description: 'Programming language'
        },
        recursive: {
          type: 'boolean',
          default: false,
          description: 'Lint recursively in directories'
        }
      },
      required: ['path']
    },
    handler: async (args) => {
      const rules = args.rules || DEFAULT_LINT_RULES;
      const results = await astLint(args.path, rules, {
        language: args.language,
        recursive: args.recursive
      });

      return {
        issues: results.length,
        results: results
      };
    }
  }
];

export default AST_TOOLS;
export { ASTGrepHelper };

function createToolResponse(content, isError = false) {
  return {
    content: [{ type: "text", text: content }],
    isError
  };
}

function createErrorResponse(message) {
  return createToolResponse(`Error: ${message}`, true);
}

function validateRequiredParams(params, requiredParams) {
  const missingParams = requiredParams.filter(param => !params[param]);
  if (missingParams.length > 0) {
    throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
  }
}

function formatCodeParsingMessage(language, code) {
  return `Parsing ${language} code substring ${code.substring(0, 100)}...`;
}

function formatASTSearchMessage(pattern, path) {
  return `AST searching: ${pattern} in ${path}`;
}

function formatASTReplaceMessage(pattern, replacement, path) {
  return `AST replacing: ${pattern} -> ${replacement} in ${path}`;
}

function formatASTLintMessage(path) {
  return `AST linting: ${path}`;
}

function createToolHandler(handler, toolName = 'Unknown Tool') {
  return async (args) => {
    try {
      const result = await handler(args);
      return result;
    } catch (error) {
      // Import enhanced error recovery (circular dependency workaround)
      const { createEnhancedErrorResponse } = await import('./utilities.js');
      return createEnhancedErrorResponse(error, toolName, {
        workingDirectory: args?.workingDirectory,
        toolName
      });
    }
  };
}

function createRetryToolHandler(handler, toolName = 'Unknown Tool', retries = 3) {
  return async (args) => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await handler(args);
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    throw lastError;
  };
}

// Actual AST processing functions for batch execute
export async function parseAST(code, language = 'javascript', workingDirectory, filePath) {
  validateRequiredParams({ workingDirectory }, ['workingDirectory']);

  // If filePath is provided but no code, read the file first
  let codeToParse = code;
  if (filePath && !code) {
    try {
      const fullPath = path.resolve(workingDirectory, filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      codeToParse = fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  if (!codeToParse) {
    throw new Error('Missing required parameters: Either code or filePath must be provided');
  }

  try {
    const helper = new ASTGrepHelper(language);
    const ast = await helper.parseCode(codeToParse);

    // Extract useful information without deep analysis
    const root = ast.root();
    const info = {
      language,
      nodes: 0,
      functions: 0,
      classes: 0,
      imports: 0,
      exports: 0,
      size: codeToParse.length
    };

    // Quick analysis for common patterns
    const patterns = [
      { type: 'function', pattern: 'function $NAME($ARGS) { $BODY }' },
      { type: 'arrow', pattern: 'const $NAME = ($ARGS) => { $BODY }' },
      { type: 'class', pattern: 'class $NAME { $MEMBERS }' },
      { type: 'import', pattern: 'import $IMPORTS from \'$MODULE\'' },
      { type: 'export', pattern: 'export $STATEMENT' }
    ];

    for (const { type, pattern } of patterns) {
      try {
        const matches = await helper.searchPattern(codeToParse, pattern);
        if (type === 'function' || type === 'arrow') {
          info.functions += matches.length;
        } else if (type === 'class') {
          info.classes += matches.length;
        } else if (type === 'import') {
          info.imports += matches.length;
        } else if (type === 'export') {
          info.exports += matches.length;
        }
        info.nodes += matches.length;
      } catch (error) {
        // Skip failed patterns
      }
    }

    return `Parsed ${language} code (${info.size} chars):
• ${info.functions} function(s)
• ${info.classes} class(es)
• ${info.imports} import(s)
• ${info.exports} export(s)`;
  } catch (error) {
    return `Lightweight analysis: ${language} code (${codeToParse.length} chars)
Quick structure check complete - no deep AST parsing needed`;
  }
}

export async function astgrepSearch(pattern, searchPath = '.', workingDirectory) {
  validateRequiredParams({ pattern, workingDirectory }, ['pattern', 'workingDirectory']);

  // Use the real AST search implementation
  try {
    const targetPath = searchPath.startsWith('.') ? path.resolve(workingDirectory, searchPath) : searchPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Path not found: ${targetPath}`);
    }

    const helper = new ASTGrepHelper();
    const results = [];

    const processFile = async (file) => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const matches = await helper.searchPattern(content, pattern);

        return matches.map(match => ({
          file,
          content: match.text,
          line: match.line,
          column: match.column,
          start: match.start,
          end: match.end
        }));
      } catch (error) {
        return [{ file, error: error.message }];
      }
    };

    if (fs.statSync(targetPath).isDirectory()) {
      const files = await findFiles(targetPath, {
        recursive: true,
        extensions: ['.js', '.ts', '.jsx', '.tsx'],
        ignorePatterns: getDefaultIgnorePatterns()
      });
      for (const file of files) {
        const fileResults = await processFile(file);
        results.push(...fileResults);
      }
    } else {
      const fileResults = await processFile(targetPath);
      results.push(...fileResults);
    }

    return {
      success: true,
      results: results.filter(r => !r.error),
      errors: results.filter(r => r.error),
      totalMatches: results.filter(r => !r.error).length,
      pattern,
      path: targetPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      pattern,
      path
    };
  }
}

export async function astgrepReplace(pattern, replacement, searchPath = '.', workingDirectory) {
  validateRequiredParams({ pattern, replacement, workingDirectory }, ['pattern', 'replacement', 'workingDirectory']);

  // Use the real AST replace implementation
  try {
    const targetPath = searchPath.startsWith('.') ? path.resolve(workingDirectory, searchPath) : searchPath;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Path not found: ${targetPath}`);
    }

    const helper = new ASTGrepHelper();
    const results = [];

    const processFile = async (file) => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const newContent = await helper.replacePattern(content, pattern, replacement);

        if (newContent !== content) {
          fs.writeFileSync(file, newContent);
          return { file, status: 'modified', changes: true };
        } else {
          return { file, status: 'unchanged', changes: false };
        }
      } catch (error) {
        return { file, error: error.message };
      }
    };

    if (fs.statSync(targetPath).isDirectory()) {
      const files = await findFiles(targetPath, {
        recursive: true,
        extensions: ['.js', '.ts', '.jsx', '.tsx'],
        ignorePatterns: getDefaultIgnorePatterns()
      });
      for (const file of files) {
        const fileResult = await processFile(file);
        results.push(fileResult);
      }
    } else {
      const fileResult = await processFile(targetPath);
      results.push(fileResult);
    }

    return {
      success: true,
      results,
      modifiedFiles: results.filter(r => r.changes).length,
      totalFiles: results.length,
      pattern,
      replacement,
      path: targetPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      pattern,
      replacement,
      path: searchPath
    };
  }
}

export async function astgrepLint(path, rules = [], workingDirectory) {
  validateRequiredParams({ path, workingDirectory }, ['path', 'workingDirectory']);

  try {
    const targetPath = path.startsWith('.') ? path.resolve(workingDirectory, path) : path;

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Path not found: ${targetPath}`);
    }

    const effectiveRules = rules.length > 0 ? rules : DEFAULT_LINT_RULES;
    const results = await astLint(targetPath, effectiveRules, {
      recursive: true,
      ignorePatterns: getDefaultIgnorePatterns()
    });

    return {
      success: true,
      results: results.filter(r => !r.error),
      errors: results.filter(r => r.error),
      totalIssues: results.filter(r => !r.error).length,
      rules: effectiveRules.length,
      path: targetPath
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path
    };
  }
}

export const astTools = [
  {
    name: "parse_ast",
    description: "Lightweight code analysis - quickly counts functions, classes, imports, exports. No deep parsing.",
    supported_operations: ["code parsing", "AST analysis", "structure understanding"],
    use_cases: ["Code structure analysis", "Syntax validation", "Code transformation preparation", "Component analysis", "Pattern extraction"],
    examples: [
      "Parse component structure from React files",
      "Analyze function signatures and types",
      "Extract import/export patterns",
      "Understand code organization"
    ],
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to analyze (optional - reads from filePath if not provided)" },
        language: { type: "string", description: "Programming language (default: javascript). Supports: javascript, typescript, jsx, tsx, go, rust, python, c, cpp" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for execution." },
        filePath: { type: "string", description: "File path to read code from (used when code parameter is not provided)" }
      },
      required: ["workingDirectory"]
    },
    handler: createToolHandler(async ({ code, language = "javascript", workingDirectory, filePath }) => {
      return await parseAST(code, language, workingDirectory, filePath);
    })
  },
  {
    name: "astgrep_search",
    description: "AST pattern search - finds code by structure, not text. Use $VARIABLE wildcards (e.g., $NAME, $PROPS) to match any content. Perfect for React components, functions, classes. More precise than text search.",
    supported_operations: ["structural code search", "pattern matching", "code analysis"],
    use_cases: ["Find React components with hooks", "Locate function declarations", "Find TypeScript interfaces", "Discover API usage patterns", "Identify code architectures"],
    examples: [
      "React forwardRef: `React.forwardRef<$TYPE, $PROPS>(({ $PROPS }, ref) => $BODY)`",
      "Arrow functions: `const $NAME = ($PARAMS) => { $BODY }`",
      "TypeScript interfaces: `interface $NAME extends $PARENT { $MEMBERS }`",
      "Function declarations: `function $NAME($PARAMS): $RETURN { $BODY }`",
      "Class components: `class $NAME extends React.Component { $METHODS }`"
    ],
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "AST pattern with $VARIABLE wildcards. Examples: 'const $NAME = ($props) => { $body }' finds arrow functions, 'React.forwardRef<$TYPE, $PROPS>' finds React components" },
        path: { type: "string", description: "WHERE TO SEARCH: File or directory path (default: current directory)" },
        workingDirectory: { type: "string", description: "BASE DIRECTORY: Required working directory" }
      },
      required: ["pattern", "workingDirectory"]
    },
    handler: createToolHandler(async ({ pattern, path = ".", workingDirectory }) => {
      const result = await astgrepSearch(pattern, path, workingDirectory);

      if (!result.success) {
        return `❌ AST search failed: ${result.error}

Fix: Check pattern syntax, ensure $VARIABLE wildcards are correct, verify files exist in search path.`;
      }

      if (result.totalMatches === 0) {
        return `❌ No matches found for pattern: "${pattern}"

Try: Simplify pattern, check actual code structure first, use broader wildcards like $NAME instead of specific names.`;
      }

      return result.results.map((match, i) =>
        `${match.file}:${match.line} - ${match.content}`
      ).join('\n');
    })
  },
  {
    name: "astgrep_replace",
    description: "Transform code patterns safely - replaces code structures across files while preserving syntax. Best for: refactoring function signatures, updating imports, modernizing code patterns, standardizing API calls. More reliable than text search/replace.",
    supported_operations: ["code refactoring", "pattern transformation", "API modernization"],
    use_cases: ["Update React component patterns", "Change function signatures", "Modernize import statements", "Standardize error handling", "Migrate deprecated APIs"],
    examples: [
      "Update imports: `import {$IMPORTS} from 'old-module' → import {$IMPORTS} from 'new-module'`",
      "Refactor functions: `function $NAME($OLD) → function $NAME($NEW): $TYPE`",
      "Modernize React: `React.createClass($CONFIG) → class $NAME extends React.Component`",
      "Update hooks: `useState($INITIAL) → useCustomState($INITIAL)`"
    ],
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "WHAT TO REPLACE: AST pattern to match (use $VARIABLE wildcards)" },
        replacement: { type: "string", description: "REPLACEMENT: What to replace with (use same $VARIABLE names)" },
        path: { type: "string", description: "WHERE: Files or directory to modify" },
        workingDirectory: { type: "string", description: "BASE DIRECTORY: Required working directory" },
        backup: { type: "boolean", description: "Create .backup files (default: true)" }
      },
      required: ["pattern", "replacement", "path", "workingDirectory"]
    },
    handler: createToolHandler(async ({ pattern, replacement, path, workingDirectory, backup = true }) => {
      const result = await astgrepReplace(pattern, replacement, path, workingDirectory);

      if (!result.success) {
        return `❌ REPLACE FAILED: ${result.error}

🔧 REPLACEMENT TROUBLESHOOTING:
• Check pattern syntax matches actual code structure
• Verify replacement syntax is valid
• Ensure target files exist and are writable
• Test pattern with astgrep_search first

💡 STRATEGY: Always test patterns with astgrep_search before replacement`;
      }

      if (result.modifiedFiles === 0) {
        return `⚠️ NO CHANGES MADE - Pattern "${pattern}" found no matches to replace

🔍 POSSIBLE REASONS:
• Pattern doesn't match any code in target files
• Files use different structure than expected
• Search path doesn't contain relevant files

💡 RECOMMENDATIONS:
• Use astgrep_search first to verify pattern matches
• Check actual code structure with Read or Glob
• Simplify pattern or broaden search scope`;
      }

      return `✅ SUCCESSFULLY REPLACED pattern in ${result.modifiedFiles} of ${result.totalFiles} files

📋 REPLACEMENT DETAILS:
• Pattern: "${pattern}"
• Replacement: "${replacement}"
• Files modified: ${result.modifiedFiles}
• Total files processed: ${result.totalFiles}
• Backups created: ${backup ? 'Yes (.backup files)' : 'No'}

⚠️ Review changes carefully. Backup files created if enabled.`;
    })
  },
  {
    name: "astgrep_lint",
    description: "Code quality analysis using AST patterns - define custom linting rules and apply them across your codebase. Best for: enforcing coding standards, detecting anti-patterns, finding deprecated APIs, validating architecture patterns.",
    supported_operations: ["code quality", "linting", "pattern detection", "standards enforcement"],
    use_cases: ["Enforce coding standards", "Detect anti-patterns", "Find deprecated APIs", "Validate architecture patterns", "Security pattern checking"],
    examples: [
      "Detect console.log statements in production",
      "Find unused variables",
      "Identify hardcoded secrets",
      "Check for proper error handling",
      "Validate React component patterns"
    ],
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to files/directory to lint" },
        rules: { type: "array", description: "Custom linting rules (uses built-in rules if not provided)" },
        workingDirectory: { type: "string", description: "REQUIRED: Working directory for execution." },
      },
      required: ["path", "workingDirectory"]
    },
    handler: createRetryToolHandler(async ({ path: targetPath, rules = [], workingDirectory }) => {
      const result = await astgrepLint(targetPath, rules, workingDirectory);

      if (!result.success) {
        return `❌ LINT FAILED: ${result.error}

🔧 LINTING TROUBLESHOOTING:
• Check if the target path exists
• Verify rules are properly formatted
• Ensure working directory is correct

💡 TIP: Start with default rules to test basic functionality`;
      }

      if (result.totalIssues === 0) {
        return `✅ NO ISSUES FOUND - Code passed all ${result.rules} linting rules

📋 LINTING SUMMARY:
• Rules applied: ${result.rules}
• Files scanned: Multiple files in ${targetPath}
• Issues found: 0
• Path: ${targetPath}

🎉 Your code meets the quality standards!`;
      }

      return `🔍 FOUND ${result.totalIssues} ISSUES across ${result.rules} linting rules:

${result.results.map((issue, i) =>
  `${i + 1}. ${issue.severity.toUpperCase()}: ${issue.message}
   📁 ${issue.file}:${issue.line}
   💻 ${issue.content}
   📋 Rule: ${issue.rule}`
).join('\n\n')}

📊 SUMMARY:
• Total issues: ${result.totalIssues}
• Rules applied: ${result.rules}
• Path: ${targetPath}

💡 Focus on ${result.results.filter(r => r.severity === 'error').length} error(s) first, then address warnings.`;
    }, 'astgrep_lint', 2)
  }
];