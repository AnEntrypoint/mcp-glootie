#!/usr/bin/env node

import fs from 'fs';

// Read and analyze the real experiences from step files
function analyzeExperience(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const stepData = data.stepData;

    const experience = {
        testType: data.testType,
        testName: data.testName,
        totalSteps: stepData.length,
        assistantSteps: 0,
        toolCalls: [],
        mcpToolCalls: [],
        errors: [],
        successes: [],
        timingIssues: [],
        keyMoments: [],
        workflow: []
    };

    stepData.forEach((step, index) => {
        if (step.type === 'assistant') {
            experience.assistantSteps++;

            // Track tool calls
            if (step.message && step.message.content) {
                step.message.content.forEach(item => {
                    if (item.type === 'tool_use') {
                        const toolCall = {
                            name: item.name,
                            step: index,
                            input: item.input
                        };
                        experience.toolCalls.push(toolCall);

                        if (item.name.startsWith('mcp__glootie__')) {
                            experience.mcpToolCalls.push(toolCall);
                        }
                    }
                });
            }
        }

        // Track user responses and results
        if (step.type === 'user' && step.message && step.message.content) {
            step.message.content.forEach(item => {
                if (item.type === 'tool_result') {
                    const content = item.content || '';

                    // Look for specific patterns
                    if (content.includes('error') || content.includes('Error') || content.includes('failed')) {
                        experience.errors.push({
                            step: index,
                            content: content.substring(0, 200)
                        });
                    }

                    if (content.includes('success') || content.includes('completed') || content.includes('successfully')) {
                        experience.successes.push({
                            step: index,
                            content: content.substring(0, 200)
                        });
                    }

                    // Look for timing issues or timeouts
                    if (content.includes('timeout') || content.includes('timed out') || content.includes('took too long')) {
                        experience.timingIssues.push({
                            step: index,
                            content: content.substring(0, 200)
                        });
                    }

                    // Track key workflow moments
                    if (content.includes('File created successfully') ||
                        content.includes('Todos have been modified') ||
                        content.includes('Build completed') ||
                        content.includes('No ESLint warnings')) {
                        experience.keyMoments.push({
                            step: index,
                            content: content.substring(0, 150)
                        });
                    }
                }
            });
        }
    });

    return experience;
}

// Analyze all tests
const testTypes = ['ui-generation', 'component-analysis', 'optimization', 'refactoring'];
const experiences = {};

testTypes.forEach(testType => {
    const baselineFile = `./results/claude-steps-${testType}-baseline.json`;
    const mcpFile = `./results/claude-steps-${testType}-mcp.json`;

    if (fs.existsSync(baselineFile) && fs.existsSync(mcpFile)) {
        experiences[testType] = {
            baseline: analyzeExperience(baselineFile),
            mcp: analyzeExperience(mcpFile)
        };
    }
});

// Generate the review
console.log(experiences);