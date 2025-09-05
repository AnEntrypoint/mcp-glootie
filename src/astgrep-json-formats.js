import { spawn } from 'child_process';
import * as path from 'node:path';

/**
 * Enhanced JSON output control for ast-grep operations
 * Provides stream, pretty, and structured metadata formatting
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

export const enhancedAstGrepSearch = async (pattern, options = {}) => {
  const {
    language,
    paths = ['.'],
    context,
    strictness,
    jsonFormat = 'compact', // 'compact', 'stream', 'pretty'
    includeMetadata = true,
    workingDirectory
  } = options;

  const args = ['run'];
  
  // Enhanced JSON format control
  switch (jsonFormat) {
    case 'stream':
      args.push('--json=stream');
      break;
    case 'pretty':
      args.push('--json=pretty'); 
      break;
    case 'compact':
    default:
      args.push('--json=compact');
      break;
  }
  
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern);
  if (context && context > 0) args.push('--context', context.toString());
  if (strictness) args.push('--strictness', strictness);
  
  // Add metadata collection flags
  if (includeMetadata) {
    args.push('--debug-query');
  }
  
  args.push(...paths);
  
  const result = await executeAstGrepCommand(args, workingDirectory);
  
  if (result.success && result.parsedOutput) {
    const transformedResults = Array.isArray(result.parsedOutput) 
      ? result.parsedOutput.map(match => ({
          file: match.file,
          startLine: match.range?.start?.line || 0,
          endLine: match.range?.end?.line || 0,
          startColumn: match.range?.start?.column || 0,
          endColumn: match.range?.end?.column || 0,
          text: match.text || match.lines,
          metaVariables: match.metaVariables || {},
          language: match.language,
          range: match.range,
          // Enhanced metadata
          nodeType: match.nodeType,
          parentType: match.parentType,
          depth: match.depth || 0,
          ...(includeMetadata && {
            metadata: {
              matchStrategy: strictness || 'smart',
              patternComplexity: calculatePatternComplexity(pattern),
              contextLines: context || 0,
              timestamp: new Date().toISOString()
            }
          })
        }))
      : [];
      
    return {
      success: true,
      results: transformedResults,
      executionTimeMs: result.executionTimeMs,
      totalMatches: transformedResults.length,
      format: jsonFormat,
      ...(includeMetadata && {
        searchMetadata: {
          pattern,
          language: language || 'auto-detect',
          paths,
          timestamp: new Date().toISOString(),
          performance: {
            executionTimeMs: result.executionTimeMs,
            matchesPerSecond: Math.round(transformedResults.length / (result.executionTimeMs / 1000))
          }
        }
      })
    };
  }
  
  return {
    success: false,
    error: result.error || result.stderr || result.jsonError || 'Search failed',
    executionTimeMs: result.executionTimeMs
  };
};

export const enhancedAstGrepReplace = async (pattern, replacement, options = {}) => {
  const {
    language,
    paths = ['.'],
    dryRun = true,
    interactive = false,
    jsonFormat = 'compact',
    includeMetadata = true,
    workingDirectory
  } = options;

  const args = ['run'];
  
  // Enhanced JSON format control
  switch (jsonFormat) {
    case 'stream':
      args.push('--json=stream');
      break;
    case 'pretty':
      args.push('--json=pretty');
      break;
    case 'compact':
    default:
      args.push('--json=compact');
      break;
  }
  
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern);
  args.push('--rewrite', replacement);
  
  if (dryRun) args.push('--dry-run');
  if (interactive) args.push('--interactive');
  
  args.push(...paths);
  
  const result = await executeAstGrepCommand(args, workingDirectory);
  
  if (result.success) {
    const changes = result.parsedOutput || [];
    return {
      success: true,
      changes: Array.isArray(changes) ? changes.map(change => ({
        file: change.file,
        oldText: change.old || change.before,
        newText: change.new || change.after,
        startLine: change.range?.start?.line || 0,
        endLine: change.range?.end?.line || 0,
        ...(includeMetadata && {
          metadata: {
            dryRun,
            interactive,
            timestamp: new Date().toISOString(),
            changeType: detectChangeType(change.old, change.new)
          }
        })
      })) : [],
      executionTimeMs: result.executionTimeMs,
      totalChanges: Array.isArray(changes) ? changes.length : 0,
      dryRun,
      format: jsonFormat
    };
  }
  
  return {
    success: false,
    error: result.error || result.stderr || 'Replace operation failed',
    executionTimeMs: result.executionTimeMs
  };
};

// Utility functions for metadata enhancement
const calculatePatternComplexity = (pattern) => {
  const metaVarCount = (pattern.match(/\$\w+/g) || []).length;
  const multiVarCount = (pattern.match(/\$\$\$\w+/g) || []).length;
  const nodeCount = (pattern.split(/[\s\{\}\(\)\[\];,]/).filter(t => t.trim()).length);
  
  return {
    metaVariables: metaVarCount,
    multiVariables: multiVarCount,
    nodeCount,
    complexity: Math.min((metaVarCount * 2 + multiVarCount * 3 + nodeCount) / 10, 10)
  };
};

const detectChangeType = (oldText, newText) => {
  if (!oldText && newText) return 'addition';
  if (oldText && !newText) return 'deletion';
  if (oldText === newText) return 'no-change';
  
  const oldLines = oldText?.split('\n').length || 0;
  const newLines = newText?.split('\n').length || 0;
  
  if (newLines > oldLines) return 'expansion';
  if (newLines < oldLines) return 'reduction';
  return 'modification';
};