#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read all results files and analyze patterns
const resultsDir = './results';
const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json') && !f.includes('README'));

console.log('=== MCP TOOL USAGE ANALYSIS ===\n');

const analysis = {
  stepFiles: [],
  outputFiles: [],
  toolUsagePatterns: new Map(),
  performanceData: [],
  failurePoints: []
};

// Process all files
files.forEach(file => {
  try {
    const filePath = path.join(resultsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (file.includes('claude-steps-')) {
      analysis.stepFiles.push({
        file,
        testType: data.testType,
        testCategory: data.testCategory,
        testName: data.testName,
        duration: data.duration,
        totalSteps: data.totalSteps,
        toolCallsCount: data.toolCallsCount,
        success: !data.parseError
      });
    }

    if (file.includes('claude-output-')) {
      analysis.outputFiles.push({
        file,
        testType: data.testType,
        testCategory: data.testCategory,
        outputLength: data.outputLength
      });
    }
  } catch (error) {
    console.warn(`Warning: Could not parse ${file}: ${error.message}`);
  }
});

// Analyze tool usage patterns
console.log('1. TEST COMPLETION STATUS:');
const testsByCategory = new Map();
analysis.stepFiles.forEach(step => {
  if (!testsByCategory.has(step.testCategory)) {
    testsByCategory.set(step.testCategory, { baseline: null, mcp: null });
  }
  testsByCategory.get(step.testCategory)[step.testType] = step;
});

testsByCategory.forEach((tests, category) => {
  const baseline = tests.baseline;
  const mcp = tests.mcp;

  console.log(`\\n${category.toUpperCase()}:`);
  console.log(`  Baseline: ${baseline ? (baseline.success ? 'SUCCESS' : 'FAILED') : 'MISSING'} (${baseline?.duration?.toFixed(1)}s, ${baseline?.totalSteps} steps)`);
  console.log(`  MCP:      ${mcp ? (mcp.success ? 'SUCCESS' : 'FAILED') : 'MISSING'} (${mcp?.duration?.toFixed(1)}s, ${mcp?.totalSteps} steps)`);

  if (baseline && mcp && baseline.success && mcp.success) {
    const improvement = ((baseline.duration - mcp.duration) / baseline.duration * 100).toFixed(1);
    console.log(`  Performance: ${improvement}% ${improvement > 0 ? 'improvement' : 'degradation'}`);
  }
});

// Check for missing tests
console.log('\\n2. MISSING TEST COVERAGE:');
const expectedTests = ['component-analysis', 'ui-generation', 'refactoring', 'optimization'];
expectedTests.forEach(testType => {
  const tests = testsByCategory.get(testType);
  if (!tests || !tests.baseline) console.log(`  Missing baseline for: ${testType}`);
  if (!tests || !tests.mcp) console.log(`  Missing MCP test for: ${testType}`);
});

// Analyze raw outputs for tool preferences
console.log('\\n3. TOOL USAGE PATTERNS FROM OUTPUTS:');
const toolMentions = new Map();

analysis.outputFiles.forEach(output => {
  try {
    const filePath = path.join(resultsDir, output.file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (data.rawOutput) {
      // Count tool mentions in raw output
      const tools = [
        'mcp__glootie__execute', 'mcp__glootie__batch_execute',
        'mcp__glootie__searchcode', 'mcp__glootie__astgrep_search',
        'mcp__glootie__astgrep_replace', 'mcp__glootie__astgrep_lint',
        'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob'
      ];

      tools.forEach(tool => {
        const mentions = (data.rawOutput.match(new RegExp(tool, 'g')) || []).length;
        if (mentions > 0) {
          if (!toolMentions.has(tool)) toolMentions.set(tool, { baseline: 0, mcp: 0 });
          toolMentions.get(tool)[output.testType] += mentions;
        }
      });
    }
  } catch (error) {
    console.warn(`Could not analyze output file ${output.file}: ${error.message}`);
  }
});

// Print tool usage
console.log('\\nTool usage frequency:');
[...toolMentions.entries()]
  .sort((a, b) => (b[1].baseline + b[1].mcp) - (a[1].baseline + a[1].mcp))
  .forEach(([tool, usage]) => {
    console.log(`  ${tool}: baseline=${usage.baseline}, mcp=${usage.mcp}`);
  });

console.log('\\n4. RECOMMENDATIONS FOR TOOL DESCRIPTIONS:');
console.log('Based on this analysis, tool descriptions should emphasize:');

// Check if MCP tools were actually used
const mcpToolsUsed = [...toolMentions.keys()].filter(tool => tool.startsWith('mcp__')).length;
const baselineToolsUsed = [...toolMentions.keys()].filter(tool => !tool.startsWith('mcp__')).length;

if (mcpToolsUsed < baselineToolsUsed) {
  console.log('- CRITICAL: MCP tools are being underutilized vs baseline tools');
  console.log('- Tool descriptions must STRONGLY emphasize MCP tool preference');
  console.log('- Need explicit "ignore other tools" language');
}

console.log('- batch_execute should have 10:1 preference over individual execution');
console.log('- searchcode should override Grep/Glob for code searches');
console.log('- astgrep should be preferred over Edit/Read for code modification');
console.log('- execute should require hypothesis testing before file edits');

console.log('\\n=== ANALYSIS COMPLETE ===');