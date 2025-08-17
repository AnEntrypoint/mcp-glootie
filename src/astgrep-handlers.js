import { validateWorkingDirectory } from './validation-utils.js';

export const handleAstGrepSearch = async (args, defaultWorkingDir, getAstGrepUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { pattern, language, paths, context, strictness, outputFormat } = args;
  if (!pattern) {
    return { content: [{ type: 'text', text: 'ERROR: Missing pattern argument for ast-grep search' }] };
  }
  
  try {
    const { astgrepUtils } = await getAstGrepUtils();
    const result = await astgrepUtils.astgrepSearch(
      pattern, language, paths, context, strictness, outputFormat, dirValidation.effectiveDir
    );
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text', 
        text: `AST-grep search for pattern: "${pattern}"\nLanguage: ${language || 'auto-detect'}\nFound ${result.totalMatches} match(es)` });
      
      if (result.results.length === 0) {
        outputLines.push({ type: 'text', text: 'No matches found.' });
      } else {
        result.results.forEach((match, index) => {
          const metaVars = match.metaVariables?.single ? 
            Object.entries(match.metaVariables.single).map(([key, val]) => `${key}: ${val.text}`).join(', ') : 'none';
          outputLines.push({ type: 'text',
            text: `[${index + 1}] ${match.file}:${match.startLine}-${match.endLine}\nMeta variables: ${metaVars}\nCode:\n${match.text}` });
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

export const handleAstGrepReplace = async (args, defaultWorkingDir, getAstGrepUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { pattern, replacement, language, paths, dryRun, interactive } = args;
  if (!pattern || !replacement) {
    return { content: [{ type: 'text', text: 'ERROR: Missing pattern or replacement argument for ast-grep replace' }] };
  }
  
  try {
    const { astgrepUtils } = await getAstGrepUtils();
    const result = await astgrepUtils.astgrepReplace(
      pattern, replacement, language, paths, dryRun, interactive, dirValidation.effectiveDir
    );
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text',
        text: `AST-grep replace operation ${dryRun ? '(DRY RUN)' : ''}\nPattern: "${pattern}"\nReplacement: "${replacement}"\nProcessed ${result.results.length} match(es)` });
      
      if (result.results.length > 0) {
        result.results.forEach((match, index) => {
          outputLines.push({ type: 'text', text: `[${index + 1}] ${match.file || 'Unknown file'}: Applied replacement` });
        });
      }
      outputLines.push({ type: 'text', text: `Replace operation completed in ${result.executionTimeMs}ms` });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};