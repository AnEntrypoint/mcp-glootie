#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const resultsDir = '/config/workspace/mcp-repl/results';
const files = [
  'claude-output-component-analysis-mcp.json',
  'claude-output-component-analysis-baseline.json',
  'claude-output-optimization-mcp.json',
  'claude-output-optimization-baseline.json',
  'claude-output-refactoring-mcp.json',
  'claude-output-refactoring-baseline.json',
  'claude-output-ui-generation-mcp.json',
  'claude-output-ui-generation-baseline.json'
];

function extractToolUsage(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const toolMatches = content.match(/"name":"([^"]*)"/g) || [];
    const tools = {};

    toolMatches.forEach(match => {
      const toolName = match.replace(/"name":"([^"]*)"/, '$1');
      tools[toolName] = (tools[toolName] || 0) + 1;
    });

    return tools;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return {};
  }
}

function analyzeFile(filePath) {
  const stats = fs.statSync(filePath);
  const tools = extractToolUsage(filePath);
  const totalTools = Object.values(tools).reduce((sum, count) => sum + count, 0);

  return {
    file: path.basename(filePath),
    size: stats.size,
    totalTools,
    tools
  };
}

console.log('='.repeat(80));
console.log('MCP TOOL USAGE ANALYSIS');
console.log('='.repeat(80));

const results = {};

files.forEach(file => {
  const filePath = path.join(resultsDir, file);
  if (fs.existsSync(filePath)) {
    const analysis = analyzeFile(filePath);
    results[file] = analysis;

    console.log(`\n${file.toUpperCase()}`);
    console.log('-'.repeat(60));
    console.log(`File Size: ${analysis.size.toLocaleString()} bytes`);
    console.log(`Total Tool Uses: ${analysis.totalTools}`);
    console.log('Tool Breakdown:');

    Object.entries(analysis.tools)
      .sort(([,a], [,b]) => b - a)
      .forEach(([tool, count]) => {
        console.log(`  ${tool}: ${count}`);
      });
  }
});

// Summary comparison
console.log('\n\n' + '='.repeat(80));
console.log('MCP vs BASELINE COMPARISON');
console.log('='.repeat(80));

const categories = [
  'component-analysis',
  'optimization',
  'refactoring',
  'ui-generation'
];

categories.forEach(category => {
  const mcpFile = `claude-output-${category}-mcp.json`;
  const baselineFile = `claude-output-${category}-baseline.json`;

  if (results[mcpFile] && results[baselineFile]) {
    console.log(`\n${category.toUpperCase()}:`);
    console.log(`  MCP Total Tools: ${results[mcpFile].totalTools}`);
    console.log(`  Baseline Total Tools: ${results[baselineFile].totalTools}`);
    console.log(`  MCP File Size: ${results[mcpFile].size.toLocaleString()} bytes`);
    console.log(`  Baseline File Size: ${results[baselineFile].size.toLocaleString()} bytes`);

    // Find MCP-specific tools
    const mcpTools = new Set(Object.keys(results[mcpFile].tools));
    const baselineTools = new Set(Object.keys(results[baselineFile].tools));
    const mcpSpecificTools = [...mcpTools].filter(tool =>
      tool.startsWith('mcp__') && !baselineTools.has(tool)
    );

    if (mcpSpecificTools.length > 0) {
      console.log(`  MCP Tools Used: ${mcpSpecificTools.join(', ')}`);
      mcpSpecificTools.forEach(tool => {
        console.log(`    ${tool}: ${results[mcpFile].tools[tool]} uses`);
      });
    }
  }
});

console.log('\n\n' + '='.repeat(80));
console.log('EXECUTIVE SUMMARY');
console.log('='.repeat(80));

let totalMcpTools = 0;
let totalBaselineTools = 0;
let totalMcpSize = 0;
let totalBaselineSize = 0;

categories.forEach(category => {
  const mcpFile = `claude-output-${category}-mcp.json`;
  const baselineFile = `claude-output-${category}-baseline.json`;

  if (results[mcpFile] && results[baselineFile]) {
    totalMcpTools += results[mcpFile].totalTools;
    totalBaselineTools += results[baselineFile].totalTools;
    totalMcpSize += results[mcpFile].size;
    totalBaselineSize += results[baselineFile].size;
  }
});

console.log(`Total MCP Tool Uses: ${totalMcpTools}`);
console.log(`Total Baseline Tool Uses: ${totalBaselineTools}`);
console.log(`Difference: ${totalMcpTools - totalBaselineTools} (${((totalMcpTools - totalBaselineTools) / totalBaselineTools * 100).toFixed(1)}% ${totalMcpTools > totalBaselineTools ? 'increase' : 'decrease'})`);
console.log(`Total MCP Output Size: ${totalMcpSize.toLocaleString()} bytes`);
console.log(`Total Baseline Output Size: ${totalBaselineSize.toLocaleString()} bytes`);
console.log(`Size Difference: ${totalMcpSize - totalBaselineSize} bytes (${((totalMcpSize - totalBaselineSize) / totalBaselineSize * 100).toFixed(1)}% ${totalMcpSize > totalBaselineSize ? 'increase' : 'decrease'})`);