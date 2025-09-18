const fs = require('fs');
const path = require('path');

const resultsDir = '/config/workspace/mcp-repl/results';
const stepFiles = [
  'claude-steps-optimization-baseline.json',
  'claude-steps-optimization-mcp.json',
  'claude-steps-ui-generation-baseline.json',
  'claude-steps-ui-generation-mcp.json',
  'claude-steps-refactoring-baseline.json',
  'claude-steps-refactoring-mcp.json',
  'claude-steps-component-analysis-baseline.json',
  'claude-steps-component-analysis-mcp.json'
];

function analyzeStepFile(filePath) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const steps = content.stepData;

  const analysis = {
    fileName: path.basename(filePath),
    testType: content.testType,
    testName: content.testName,
    totalSteps: steps.length,
    toolUsage: {},
    mcpToolUsage: {},
    standardToolUsage: {},
    errors: [],
    timing: {
      start: null,
      end: null,
      duration: null
    }
  };

  steps.forEach((step, index) => {
    // Track timing
    if (step.timestamp) {
      if (!analysis.timing.start) analysis.timing.start = step.timestamp;
      analysis.timing.end = step.timestamp;
    }

    // Track tool usage from assistant messages
    if (step.type === 'assistant' && step.message && step.message.content) {
      step.message.content.forEach(contentItem => {
        if (contentItem.type === 'tool_use') {
          const toolName = contentItem.name;
          analysis.toolUsage[toolName] = (analysis.toolUsage[toolName] || 0) + 1;

          if (toolName && toolName.startsWith('mcp__')) {
            analysis.mcpToolUsage[toolName] = (analysis.mcpToolUsage[toolName] || 0) + 1;
          } else if (toolName) {
            analysis.standardToolUsage[toolName] = (analysis.standardToolUsage[toolName] || 0) + 1;
          }
        }
      });
    }

    // Track errors
    if (step.type === 'error') {
      analysis.errors.push({
        step: index,
        message: step.message || step.error || 'Unknown error'
      });
    }
  });

  // Calculate duration
  if (analysis.timing.start && analysis.timing.end) {
    analysis.timing.duration = new Date(analysis.timing.end) - new Date(analysis.timing.start);
  }

  return analysis;
}

// Analyze all step files
const analyses = stepFiles.map(file => {
  try {
    return analyzeStepFile(path.join(resultsDir, file));
  } catch (error) {
    console.error(`Error analyzing ${file}:`, error.message);
    return null;
  }
}).filter(Boolean);

// Generate summary
console.log('=== MCP GLOOTIE V3.1.4 BENCHMARK ANALYSIS ===\n');

console.log('OVERALL STATISTICS:');
console.log(`Total Tests: ${analyses.length}`);
console.log(`Baseline Tests: ${analyses.filter(a => a.testType === 'baseline').length}`);
console.log(`MCP Tests: ${analyses.filter(a => a.testType === 'mcp').length}\n`);

// Tool usage summary
const allMcpTools = new Set();
const allStandardTools = new Set();
let totalMcpUsage = 0;
let totalStandardUsage = 0;

analyses.forEach(analysis => {
  Object.keys(analysis.mcpToolUsage).forEach(tool => allMcpTools.add(tool));
  Object.keys(analysis.standardToolUsage).forEach(tool => allStandardTools.add(tool));
  totalMcpUsage += Object.values(analysis.mcpToolUsage).reduce((sum, count) => sum + count, 0);
  totalStandardUsage += Object.values(analysis.standardToolUsage).reduce((sum, count) => sum + count, 0);
});

console.log('TOOL AVAILABILITY VS USAGE:');
console.log(`Available MCP Tools: 10 (glootie package)`);
console.log(`Actually Used MCP Tools: ${allMcpTools.size}`);
console.log(`Available Standard Tools: 15`);
console.log(`Actually Used Standard Tools: ${allStandardTools.size}\n`);

console.log(`Total MCP Tool Calls: ${totalMcpUsage}`);
console.log(`Total Standard Tool Calls: ${totalStandardUsage}\n`);

// Detailed analysis by test
console.log('DETAILED TEST ANALYSIS:');
console.log('='.repeat(80));

analyses.forEach(analysis => {
  console.log(`\n${analysis.fileName}`);
  console.log(`Test: ${analysis.testName} (${analysis.testType})`);
  console.log(`Duration: ${analysis.timing.duration ? analysis.timing.duration + 'ms' : 'N/A'}`);
  console.log(`Steps: ${analysis.totalSteps}`);
  console.log(`Errors: ${analysis.errors.length}`);

  if (Object.keys(analysis.mcpToolUsage).length > 0) {
    console.log('MCP Tools Used:');
    Object.entries(analysis.mcpToolUsage)
      .sort(([,a], [,b]) => b - a)
      .forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count} calls`);
      });
  } else {
    console.log('MCP Tools Used: None');
  }

  if (Object.keys(analysis.standardToolUsage).length > 0) {
    console.log('Standard Tools Used:');
    Object.entries(analysis.standardToolUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5) // Top 5 only
      .forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count} calls`);
      });
    if (Object.keys(analysis.standardToolUsage).length > 5) {
      console.log(`  ... and ${Object.keys(analysis.standardToolUsage).length - 5} more`);
    }
  }

  if (analysis.errors.length > 0) {
    console.log('Errors:');
    analysis.errors.forEach(error => {
      console.log(`  Step ${error.step}: ${error.message}`);
    });
  }
});

// MCP vs Baseline comparison
console.log('\n\nMCP VS BASELINE COMPARISON:');
console.log('='.repeat(80));

const baselineAnalyses = analyses.filter(a => a.testType === 'baseline');
const mcpAnalyses = analyses.filter(a => a.testType === 'mcp');

console.log('\nBASELINE TESTS:');
baselineAnalyses.forEach(analysis => {
  const mcpToolCount = Object.keys(analysis.mcpToolUsage).length;
  const mcpCallCount = Object.values(analysis.mcpToolUsage).reduce((sum, count) => sum + count, 0);
  console.log(`  ${analysis.testName}: ${mcpToolCount} MCP tools, ${mcpCallCount} calls, ${analysis.timing.duration || 'N/A'}ms`);
});

console.log('\nMCP TESTS:');
mcpAnalyses.forEach(analysis => {
  const mcpToolCount = Object.keys(analysis.mcpToolUsage).length;
  const mcpCallCount = Object.values(analysis.mcpToolUsage).reduce((sum, count) => sum + count, 0);
  console.log(`  ${analysis.testName}: ${mcpToolCount} MCP tools, ${mcpCallCount} calls, ${analysis.timing.duration || 'N/A'}ms`);
});

// Tool adoption analysis
console.log('\n\nTOOL ADOPTION ANALYSIS:');
console.log('='.repeat(80));

const mcpToolsAvailable = [
  'mcp__glootie__execute',
  'mcp__glootie__retrieve_overflow',
  'mcp__glootie__searchcode',
  'mcp__glootie__parse_ast',
  'mcp__glootie__astgrep_search',
  'mcp__glootie__astgrep_replace',
  'mcp__glootie__astgrep_lint',
  'mcp__glootie__batch_execute',
  'mcp__glootie__sequentialthinking'
];

console.log('\nMCP Tools Adoption Rate:');
mcpToolsAvailable.forEach(tool => {
  const usageCount = analyses.filter(a => a.mcpToolUsage[tool] > 0).length;
  const totalCalls = analyses.reduce((sum, a) => sum + (a.mcpToolUsage[tool] || 0), 0);
  console.log(`  ${tool}: used in ${usageCount}/${analyses.length} tests (${totalCalls} total calls)`);
});

// Error analysis
console.log('\n\nERROR ANALYSIS:');
console.log('='.repeat(80));
const allErrors = analyses.flatMap(a => a.errors);
console.log(`Total Errors: ${allErrors.length}`);
if (allErrors.length > 0) {
  const errorTypes = {};
  allErrors.forEach(error => {
    const type = error.message.split(':')[0];
    errorTypes[type] = (errorTypes[type] || 0) + 1;
  });
  console.log('Error Types:');
  Object.entries(errorTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} occurrences`);
  });
} else {
  console.log('No errors found in step data');
}