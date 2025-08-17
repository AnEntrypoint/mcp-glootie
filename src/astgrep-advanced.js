import { spawn } from 'child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const executeAstGrepAdvanced = async (args, workingDirectory, timeout = 30000) => {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const childProcess = spawn('ast-grep', args, {
      cwd: workingDirectory, timeout, env: process.env, stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    childProcess.stdout.on('data', (data) => { stdout += data; });
    childProcess.stderr.on('data', (data) => { stderr += data; });
    childProcess.on('close', (code) => {
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(),
               exitCode: code, executionTimeMs: Date.now() - startTime,
               command: `ast-grep ${args.join(' ')}` });
    });
    childProcess.on('error', (err) => {
      resolve({ success: false, error: err.message, executionTimeMs: Date.now() - startTime,
               command: `ast-grep ${args.join(' ')}` });
    });
  });
};

export const astgrepLint = async (rules, paths, severity, format, workingDirectory) => {
  let ruleFile = null, isTemporaryFile = false;
  try {
    if (typeof rules === 'string') {
      const tempDir = path.join(workingDirectory, 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      ruleFile = path.join(tempDir, `astgrep-rules-${Date.now()}.yml`);
      fs.writeFileSync(ruleFile, rules, 'utf8');
      isTemporaryFile = true;
    } else {
      ruleFile = rules;
    }
    
    const args = ['lsp', '--json'];
    if (severity) args.push('--severity', severity);
    if (format) args.push('--format', format);
    args.push('--rule', ruleFile);
    args.push(...(paths && paths.length > 0 ? paths : ['.']));
    
    const result = await executeAstGrepAdvanced(args, workingDirectory);
    let parsedOutput = null;
    try {
      if (result.stdout) parsedOutput = JSON.parse(result.stdout);
    } catch (e) {}
    
    return { success: result.success, results: parsedOutput || [], rawOutput: result.stdout,
             executionTimeMs: result.executionTimeMs,
             error: result.success ? null : (result.error || result.stderr || 'Lint operation failed') };
  } catch (error) {
    return { success: false, error: error.message, executionTimeMs: 0 };
  } finally {
    if (isTemporaryFile && ruleFile && fs.existsSync(ruleFile)) {
      try { fs.unlinkSync(ruleFile); } catch (e) {}
    }
  }
};

export const astgrepAnalyze = async (pattern, language, debugQuery, showFullTree, workingDirectory) => {
  const args = ['run'];
  if (debugQuery) args.push('--debug-query');
  args.push('--json=compact');
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern);
  if (showFullTree) args.push('--context', '999');
  args.push('.');
  
  const result = await executeAstGrepAdvanced(args, workingDirectory);
  let parsedOutput = null;
  try {
    if (result.stdout) parsedOutput = JSON.parse(result.stdout);
  } catch (e) {}
  
  const analysis = { patternMatches: parsedOutput || [], debugInfo: result.stderr || '', astStructure: null };
  if (parsedOutput && Array.isArray(parsedOutput) && parsedOutput.length > 0) {
    analysis.astStructure = parsedOutput.map(match => ({
      file: match.file, range: match.range, nodeType: match.language,
      metaVariables: match.metaVariables || {}, text: match.text || match.lines
    }));
  }
  
  return { success: result.success, analysis, executionTimeMs: result.executionTimeMs,
           error: result.success ? null : (result.error || result.stderr || 'Analysis failed') };
};