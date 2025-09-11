import { spawn } from 'child_process';
import * as path from 'node:path';

// Use CLI-only approach for maximum ARM64 compatibility
// NAPI removed to prevent double free corruption on ARM64 devices

const executeAstGrepCommand = async (args, workingDirectory, timeout = 30000) => {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const childProcess = spawn('ast-grep', args, {
      cwd: workingDirectory, timeout, env: process.env, stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '';
    childProcess.stdout.on('data', (data) => { stdout += data; });
    childProcess.stderr.on('data', (data) => { stderr += data; });
    childProcess.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;
      let parsedOutput = null, jsonError = null;
      try {
        if (stdout.trim()) parsedOutput = JSON.parse(stdout);
      } catch (e) { jsonError = e.message; }
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim(), 
               exitCode: code, parsedOutput, jsonError, executionTimeMs, 
               command: `ast-grep ${args.join(' ')}` });
    });
    childProcess.on('error', (err) => {
      let errorMessage = err.message;
      if (err.code === 'ENOENT') {
        errorMessage = `ast-grep CLI tool not found. For ARM64/aarch64 devices, install via:
• npm: npm install -g @ast-grep/cli
• pip: pip install ast-grep-cli  
• cargo: cargo install ast-grep --locked
Or use other MCP tools: executenodejs, searchcode, batch_execute`;
      }
      resolve({ success: false, error: errorMessage, executionTimeMs: Date.now() - startTime,
               command: `ast-grep ${args.join(' ')}` });
    });
  });
};

// CLI-only search function for maximum ARM64 compatibility
const astgrepSearchCli = async (pattern, language, paths, context, strictness, outputFormat, workingDirectory) => {
  const args = ['run', '--json=compact'];
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern);
  if (context && context > 0) args.push('--context', context.toString());
  if (strictness) args.push('--strictness', strictness);
  args.push(...(paths && paths.length > 0 ? paths : ['.']));
  
  const result = await executeAstGrepCommand(args, workingDirectory);
  if (result.success && result.parsedOutput) {
    const transformedResults = Array.isArray(result.parsedOutput) 
      ? result.parsedOutput.map(match => ({
          file: match.file, startLine: match.range?.start?.line || 0,
          endLine: match.range?.end?.line || 0, text: match.text || match.lines,
          metaVariables: match.metaVariables || {}, language: match.language, range: match.range
        })) : [];
    return { success: true, results: transformedResults, executionTimeMs: result.executionTimeMs,
             totalMatches: transformedResults.length };
  }
  return { success: false, error: result.error || result.stderr || result.jsonError || 'Search failed',
           executionTimeMs: result.executionTimeMs };
};

// CLI-only search function for ARM64 compatibility
export const astgrepSearch = async (pattern, language, paths, context, strictness, outputFormat, workingDirectory) => {
  return astgrepSearchCli(pattern, language, paths, context, strictness, outputFormat, workingDirectory);
};

export const astgrepReplace = async (pattern, replacement, language, paths, dryRun, interactive, workingDirectory) => {
  const args = ['run'];
  if (dryRun) args.push('--dry-run');
  if (interactive) args.push('--interactive');
  args.push('--json=compact');
  if (language) args.push('--lang', language);
  args.push('--pattern', pattern, '--rewrite', replacement);
  args.push(...(paths && paths.length > 0 ? paths : ['.']));
  
  const result = await executeAstGrepCommand(args, workingDirectory);
  return { success: result.success, results: result.parsedOutput || [],
           executionTimeMs: result.executionTimeMs, dryRun,
           error: result.success ? null : (result.error || result.stderr || 'Replace operation failed') };
};