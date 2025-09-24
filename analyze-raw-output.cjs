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

function extractToolUsageFromRawOutput(rawOutput) {
  const tools = {};

  // Extract tool uses from the raw output string
  const toolMatches = rawOutput.match(/"name":"([^"]*)"/g) || [];
  toolMatches.forEach(match => {
    const toolName = match.replace(/"name":"([^"]*)"/, '$1');
    tools[toolName] = (tools[toolName] || 0) + 1;
  });

  return tools;
}

function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    const stats = fs.statSync(filePath);

    const tools = extractToolUsageFromRawOutput(data.rawOutput || '');
    const totalTools = Object.values(tools).reduce((sum, count) => sum + count, 0);

    // Extract additional info
    const duration = data.duration_ms || 0;
    const turns = data.num_turns || 0;
    const cost = data.total_cost_usd || 0;

    return {
      file: path.basename(filePath),
      size: stats.size,
      duration,
      turns,
      cost,
      totalTools,
      tools
    };
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

console.log('='.repeat(80));
console.log('MCP TOOL USAGE ANALYSIS - RAW OUTPUT EXTRACTION');
console.log('='.repeat(80));

const results = {};

files.forEach(file => {
  const filePath = path.join(resultsDir, file);
  if (fs.existsSync(filePath)) {
    const analysis = analyzeFile(filePath);
    if (analysis) {
      results[file] = analysis;

      console.log(`\n${file.toUpperCase()}`);
      console.log('-'.repeat(60));
      console.log(`File Size: ${analysis.size.toLocaleString()} bytes`);
      console.log(`Duration: ${(analysis.duration / 1000).toFixed(1)}s`);
      console.log(`Turns: ${analysis.turns}`);
      console.log(`Cost: $${analysis.cost.toFixed(4)}`);
      console.log(`Total Tool Uses: ${analysis.totalTools}`);
      console.log('Tool Breakdown:');

      Object.entries(analysis.tools)
        .sort(([,a], [,b]) => b - a)
        .forEach(([tool, count]) => {
          console.log(`  ${tool}: ${count}`);
        });
    }
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
    console.log(`  MCP - Tools: ${results[mcpFile].totalTools}, Duration: ${(results[mcpFile].duration / 1000).toFixed(1)}s, Cost: $${results[mcpFile].cost.toFixed(4)}`);
    console.log(`  Baseline - Tools: ${results[baselineFile].totalTools}, Duration: ${(results[baselineFile].duration / 1000).toFixed(1)}s, Cost: $${results[baselineFile].cost.toFixed(4)}`);

    const toolDiff = results[mcpFile].totalTools - results[baselineFile].totalTools;
    const durationDiff = results[mcpFile].duration - results[baselineFile].duration;
    const costDiff = results[mcpFile].cost - results[baselineFile].cost;

    console.log(`  Difference - Tools: ${toolDiff > 0 ? '+' : ''}${toolDiff}, Duration: ${durationDiff > 0 ? '+' : ''}${(durationDiff / 1000).toFixed(1)}s, Cost: ${costDiff > 0 ? '+' : ''}$${costDiff.toFixed(4)}`);

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
let totalMcpDuration = 0;
let totalBaselineDuration = 0;
let totalMcpCost = 0;
let totalBaselineCost = 0;
let mcpSuccessCount = 0;
let baselineSuccessCount = 0;

categories.forEach(category => {
  const mcpFile = `claude-output-${category}-mcp.json`;
  const baselineFile = `claude-output-${category}-baseline.json`;

  if (results[mcpFile] && results[baselineFile]) {
    totalMcpTools += results[mcpFile].totalTools;
    totalBaselineTools += results[baselineFile].totalTools;
    totalMcpDuration += results[mcpFile].duration;
    totalBaselineDuration += results[baselineFile].duration;
    totalMcpCost += results[mcpFile].cost;
    totalBaselineCost += results[baselineFile].cost;

    if (results[mcpFile].duration > 0) mcpSuccessCount++;
    if (results[baselineFile].duration > 0) baselineSuccessCount++;
  }
});

console.log(`Overall Performance:`);
console.log(`  MCP - Total Tools: ${totalMcpTools}, Avg Duration: ${(totalMcpDuration / mcpSuccessCount / 1000).toFixed(1)}s, Total Cost: $${totalMcpCost.toFixed(4)}`);
console.log(`  Baseline - Total Tools: ${totalBaselineTools}, Avg Duration: ${(totalBaselineDuration / baselineSuccessCount / 1000).toFixed(1)}s, Total Cost: $${totalBaselineCost.toFixed(4)}`);

const toolDiff = totalMcpTools - totalBaselineTools;
const durationDiff = totalMcpDuration - totalBaselineDuration;
const costDiff = totalMcpCost - totalBaselineCost;

console.log(`  Differences:`);
console.log(`    Tools: ${toolDiff > 0 ? '+' : ''}${toolDiff} (${totalBaselineTools > 0 ? ((toolDiff / totalBaselineTools) * 100).toFixed(1) : 'N/A'}% ${toolDiff > 0 ? 'increase' : 'decrease'})`);
console.log(`    Duration: ${durationDiff > 0 ? '+' : ''}${(durationDiff / 1000).toFixed(1)}s (${totalBaselineDuration > 0 ? ((durationDiff / totalBaselineDuration) * 100).toFixed(1) : 'N/A'}% ${durationDiff > 0 ? 'increase' : 'decrease'})`);
console.log(`    Cost: ${costDiff > 0 ? '+' : ''}$${costDiff.toFixed(4)} (${totalBaselineCost > 0 ? ((costDiff / totalBaselineCost) * 100).toFixed(1) : 'N/A'}% ${costDiff > 0 ? 'increase' : 'decrease'})`);

// Look for specific examples of MCP tool effectiveness
console.log('\n\n' + '='.repeat(80));
console.log('MCP TOOL EFFECTIVENESS ANALYSIS');
console.log('='.repeat(80));

categories.forEach(category => {
  const mcpFile = `claude-output-${category}-mcp.json`;
  if (results[mcpFile]) {
    const mcpTools = Object.keys(results[mcpFile].tools).filter(tool => tool.startsWith('mcp__'));
    if (mcpTools.length > 0) {
      console.log(`\n${category.toUpperCase()} - MCP Tools Used:`);
      mcpTools.forEach(tool => {
        const usage = results[mcpFile].tools[tool];
        console.log(`  ${tool}: ${usage} uses`);
      });
    }
  }
});

// Check for errors or failures
console.log('\n\n' + '='.repeat(80));
console.log('ERROR AND FAILURE ANALYSIS');
console.log('='.repeat(80));

files.forEach(file => {
  const filePath = path.join(resultsDir, file);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);

      if (data.rawOutput.includes('STDIO connection dropped') ||
          data.rawOutput.includes('Connection error') ||
          data.rawOutput.includes('timeout') ||
          data.rawOutput.includes('is not valid JSON')) {
        console.log(`\n${file.toUpperCase()} - ERRORS DETECTED:`);

        const errors = data.rawOutput.match(/STDIO connection dropped/g) || [];
        const timeouts = data.rawOutput.match(/timeout/g) || [];
        const jsonErrors = data.rawOutput.match(/is not valid JSON/g) || [];

        console.log(`  Connection Drops: ${errors.length}`);
        console.log(`  Timeouts: ${timeouts.length}`);
        console.log(`  JSON Errors: ${jsonErrors.length}`);
      }
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error.message);
    }
  }
});