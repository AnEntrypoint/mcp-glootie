import { validateWorkingDirectory } from './validation-utils.js';

export const handleAstGrepLint = async (args, defaultWorkingDir, getAstGrepUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { rules, paths, severity, format } = args;
  if (!rules) {
    return { content: [{ type: 'text', text: 'ERROR: Missing rules argument for ast-grep lint' }] };
  }
  
  try {
    const { astgrepAdvanced } = await getAstGrepUtils();
    const result = await astgrepAdvanced.astgrepLint(rules, paths, severity, format, dirValidation.effectiveDir);
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text',
        text: `AST-grep lint operation\nSeverity: ${severity || 'all'}\nFormat: ${format || 'json'}` });
      
      if (result.results.length === 0) {
        outputLines.push({ type: 'text', text: 'No lint issues found.' });
      } else {
        outputLines.push({ type: 'text', text: `Found ${result.results.length} lint issue(s):` });
        result.results.forEach((issue, index) => {
          outputLines.push({ type: 'text', 
            text: `[${index + 1}] ${issue.file || 'Unknown'}: ${issue.message || issue.rule || 'Lint issue found'}` });
        });
      }
      
      if (result.rawOutput) {
        outputLines.push({ type: 'text', text: `Raw output:\n${result.rawOutput}` });
      }
      outputLines.push({ type: 'text', text: `Lint operation completed in ${result.executionTimeMs}ms` });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};

export const handleAstGrepAnalyze = async (args, defaultWorkingDir, getAstGrepUtils) => {
  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return { content: [{ type: 'text', text: `ERROR: ${dirValidation.error}` }] };
  }
  
  const { pattern, language, debugQuery, showFullTree } = args;
  if (!pattern) {
    return { content: [{ type: 'text', text: 'ERROR: Missing pattern argument for ast-grep analyze' }] };
  }
  
  try {
    const { astgrepAdvanced } = await getAstGrepUtils();
    const result = await astgrepAdvanced.astgrepAnalyze(pattern, language, debugQuery, showFullTree, dirValidation.effectiveDir);
    
    const outputLines = [];
    if (result.success) {
      outputLines.push({ type: 'text',
        text: `AST-grep analysis for pattern: "${pattern}"\nLanguage: ${language || 'auto-detect'}\nDebug mode: ${debugQuery ? 'enabled' : 'disabled'}` });
      
      if (result.analysis.debugInfo) {
        outputLines.push({ type: 'text', text: `Debug information:\n${result.analysis.debugInfo}` });
      }
      
      if (result.analysis.patternMatches.length === 0) {
        outputLines.push({ type: 'text', text: 'No pattern matches found for analysis.' });
      } else {
        outputLines.push({ type: 'text', text: `Found ${result.analysis.patternMatches.length} pattern match(es) for analysis:` });
        result.analysis.patternMatches.forEach((match, index) => {
          outputLines.push({ type: 'text',
            text: `[${index + 1}] ${match.file}:${match.range?.start?.line || 0}\nAST Node: ${match.language}\nPattern variables: ${Object.keys(match.metaVariables?.single || {}).join(', ')}` });
        });
      }
      
      if (result.analysis.astStructure) {
        outputLines.push({ type: 'text', text: `AST Structure Analysis:\n${JSON.stringify(result.analysis.astStructure, null, 2)}` });
      }
      outputLines.push({ type: 'text', text: `Analysis completed in ${result.executionTimeMs}ms` });
    } else {
      outputLines.push({ type: 'text', text: `ERROR: ${result.error}` });
    }
    return { content: outputLines };
  } catch (error) {
    return { content: [{ type: 'text', text: `ERROR: ${error.message}` }] };
  }
};