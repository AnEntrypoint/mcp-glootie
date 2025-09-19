const fs = require('fs');

console.log('=== STEP TIMING AND ERROR ANALYSIS ===');

const testTypes = ['component-analysis', 'optimization', 'refactoring', 'ui-generation'];

testTypes.forEach(testType => {
  console.log(`\n--- ${testType.toUpperCase()} ---`);

  const baselineFile = `./results/claude-steps-${testType}-baseline.json`;
  const mcpFile = `./results/claude-steps-${testType}-mcp.json`;

  try {
    const baselineData = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const mcpData = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));

    // Calculate timing
    const baselineStart = new Date(baselineData.timestamp);
    const baselineEnd = new Date(baselineData.stepData[baselineData.stepData.length - 1].timestamp || baselineData.timestamp);
    const baselineDuration = (baselineEnd - baselineStart) / 1000;

    const mcpStart = new Date(mcpData.timestamp);
    const mcpEnd = new Date(mcpData.stepData[mcpData.stepData.length - 1].timestamp || mcpData.timestamp);
    const mcpDuration = (mcpEnd - mcpStart) / 1000;

    console.log(`Baseline duration: ${baselineDuration.toFixed(2)}s`);
    console.log(`MCP duration: ${mcpDuration.toFixed(2)}s`);
    console.log(`Duration difference: ${(mcpDuration - baselineDuration).toFixed(2)}s`);

    // Look for errors or issues in steps
    console.log('\n--- Error Analysis ---');

    baselineData.stepData.forEach((step, i) => {
      if (step.type === 'user' && step.message) {
        try {
          const msg = typeof step.message === 'string' ? JSON.parse(step.message) : step.message;
          if (msg.content && msg.content.some(c => c.type === 'tool_result' && c.content && c.content.is_error)) {
            console.log(`Baseline error in step ${i}: ${msg.content.find(c => c.type === 'tool_result').content}`);
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    });

    mcpData.stepData.forEach((step, i) => {
      if (step.type === 'user' && step.message) {
        try {
          const msg = typeof step.message === 'string' ? JSON.parse(step.message) : step.message;
          if (msg.content && msg.content.some(c => c.type === 'tool_result' && c.content && c.content.is_error)) {
            console.log(`MCP error in step ${i}: ${msg.content.find(c => c.type === 'tool_result').content}`);
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    });

    // Count successful tool completions
    let baselineSuccess = 0;
    let mcpSuccess = 0;

    baselineData.stepData.forEach(step => {
      if (step.type === 'user' && step.message) {
        try {
          const msg = typeof step.message === 'string' ? JSON.parse(step.message) : step.message;
          if (msg.content && msg.content.some(c => c.type === 'tool_result' && c.content && !c.content.is_error)) {
            baselineSuccess++;
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    });

    mcpData.stepData.forEach(step => {
      if (step.type === 'user' && step.message) {
        try {
          const msg = typeof step.message === 'string' ? JSON.parse(step.message) : step.message;
          if (msg.content && msg.content.some(c => c.type === 'tool_result' && c.content && !c.content.is_error)) {
            mcpSuccess++;
          }
        } catch (e) {
          // Skip parsing errors
        }
      }
    });

    console.log(`Baseline successful tool results: ${baselineSuccess}`);
    console.log(`MCP successful tool results: ${mcpSuccess}`);

  } catch (error) {
    console.log(`Error analyzing ${testType}: ${error.message}`);
  }
});