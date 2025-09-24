const fs = require('fs');
const path = require('path');

const resultsDir = './results';
const tasks = ['component-analysis', 'ui-generation', 'refactoring', 'optimization'];

// Function to count tool calls in step data
function analyzeToolCalls(stepData) {
    const toolCalls = {};
    let totalSteps = 0;
    let totalDuration = 0;

    stepData.forEach(step => {
        totalSteps++;
        if (step.duration) {
            totalDuration += step.duration;
        }

        if (step.message && step.message.content) {
            step.message.content.forEach(item => {
                if (item.type === 'tool_use') {
                    const toolName = item.name;
                    toolCalls[toolName] = (toolCalls[toolName] || 0) + 1;
                }
            });
        }
    });

    return { toolCalls, totalSteps, totalDuration };
}

// Analyze each task
const analysis = {};
tasks.forEach(task => {
    const baselineFile = path.join(resultsDir, `claude-steps-${task}-baseline.json`);
    const mcpFile = path.join(resultsDir, `claude-steps-${task}-mcp.json`);

    if (fs.existsSync(baselineFile)) {
        const baselineData = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
        const baselineAnalysis = analyzeToolCalls(baselineData.stepData);
        analysis[task] = { baseline: baselineAnalysis };
    }

    if (fs.existsSync(mcpFile)) {
        const mcpData = JSON.parse(fs.readFileSync(mcpFile, 'utf8'));
        const mcpAnalysis = analyzeToolCalls(mcpData.stepData);
        if (!analysis[task]) analysis[task] = {};
        analysis[task].mcp = mcpAnalysis;
    }
});

console.log('Step Analysis Summary:');
console.log(JSON.stringify(analysis, null, 2));