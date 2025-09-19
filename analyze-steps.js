#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

// Read and analyze step files
function analyzeStepFile(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const stepData = data.stepData;

    const stats = {
        totalSteps: stepData.length,
        assistantSteps: 0,
        toolUsage: {},
        mcpToolUsage: {},
        timing: {
            start: null,
            end: null,
            duration: null
        },
        errors: [],
        successIndicators: []
    };

    // Analyze each step
    stepData.forEach(step => {
        if (step.type === 'assistant') {
            stats.assistantSteps++;

            // Extract tool calls
            if (step.message && step.message.content) {
                step.message.content.forEach(item => {
                    if (item.type === 'tool_use') {
                        const toolName = item.name;
                        stats.toolUsage[toolName] = (stats.toolUsage[toolName] || 0) + 1;

                        // Track MCP tools specifically
                        if (toolName.startsWith('mcp__glootie__')) {
                            stats.mcpToolUsage[toolName] = (stats.mcpToolUsage[toolName] || 0) + 1;
                        }
                    }
                });
            }
        }

        // Look for errors and success indicators
        if (step.type === 'user' && step.message && step.message.content) {
            step.message.content.forEach(item => {
                if (item.type === 'tool_result') {
                    const content = item.content || '';
                    if (content.includes('error') || content.includes('Error') || content.includes('failed')) {
                        stats.errors.push(content);
                    }
                    if (content.includes('success') || content.includes('completed') || content.includes('successfully')) {
                        stats.successIndicators.push(content);
                    }
                }
            });
        }
    });

    // Calculate timing
    if (stepData.length > 0) {
        stats.timing.start = new Date(stepData[0].timestamp || data.timestamp);
        stats.timing.end = new Date(stepData[stepData.length - 1].timestamp || data.timestamp);
        stats.timing.duration = stats.timing.end - stats.timing.start;
    }

    return stats;
}

// Analyze all test files
const testTypes = ['ui-generation', 'component-analysis', 'optimization', 'refactoring'];
const results = {};

testTypes.forEach(testType => {
    const baselineFile = `./results/claude-steps-${testType}-baseline.json`;
    const mcpFile = `./results/claude-steps-${testType}-mcp.json`;

    if (fs.existsSync(baselineFile) && fs.existsSync(mcpFile)) {
        results[testType] = {
            baseline: analyzeStepFile(baselineFile),
            mcp: analyzeStepFile(mcpFile)
        };
    }
});

// Print analysis
console.log(JSON.stringify(results, null, 2));