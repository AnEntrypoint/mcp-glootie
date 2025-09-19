const fs = require('fs');

// Analyze all test types
const testTypes = ['component-analysis', 'optimization', 'refactoring', 'ui-generation'];

console.log('=== COMPREHENSIVE TOOL USAGE ANALYSIS ===');

testTypes.forEach(testType => {
  console.log(`\n--- ${testType.toUpperCase()} ---`);

  const baselineFile = `./results/claude-steps-${testType}-baseline.json`;
  const mcpFile = `./results/claude-steps-${testType}-mcp.json`;

  try {
    const baselineData = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const mcpData = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));

    // Count tool usage
    const baselineTools = {};
    const mcpTools = {};

    baselineData.stepData.forEach(step => {
      if (step.type === 'assistant' && step.message && step.message.content) {
        step.message.content.forEach(content => {
          if (content.type === 'tool_use') {
            const toolName = content.name;
            baselineTools[toolName] = (baselineTools[toolName] || 0) + 1;
          }
        });
      }
    });

    mcpData.stepData.forEach(step => {
      if (step.type === 'assistant' && step.message && step.message.content) {
        step.message.content.forEach(content => {
          if (content.type === 'tool_use') {
            const toolName = content.name;
            mcpTools[toolName] = (mcpTools[toolName] || 0) + 1;
          }
        });
      }
    });

    console.log(`Baseline steps: ${baselineData.stepData.length}`);
    console.log(`MCP steps: ${mcpData.stepData.length}`);
    console.log(`Baseline unique tools: ${Object.keys(baselineTools).length}`);
    console.log(`MCP unique tools: ${Object.keys(mcpTools).length}`);

    console.log('\nBaseline tools:');
    Object.entries(baselineTools).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count}`);
    });

    console.log('\nMCP tools:');
    Object.entries(mcpTools).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count}`);
    });

    // Find MCP-specific tools
    const mcpSpecificTools = Object.keys(mcpTools).filter(tool => {
      return tool.startsWith('mcp__') && !baselineTools[tool];
    });

    if (mcpSpecificTools.length > 0) {
      console.log('\nMCP-specific tools used:');
      mcpSpecificTools.forEach(tool => {
        console.log(`  ${tool}: ${mcpTools[tool]}`);
      });
    }

  } catch (error) {
    console.log(`Error analyzing ${testType}: ${error.message}`);
  }
});