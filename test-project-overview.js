#!/usr/bin/env node

// Test enhanced project overview
import { spawn } from 'child_process';

async function testProjectOverview() {
  console.log('🚀 Testing enhanced project overview...');

  const server = spawn('node', ['src/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let testData = '';

  server.stdout.on('data', (data) => {
    testData += data.toString();
  });

  server.stderr.on('data', (data) => {
    const errorOutput = data.toString();
    if (errorOutput && !errorOutput.includes('MCP Glootie server running on stdio')) {
      console.log('🔴 Unexpected stderr:', errorOutput);
    }
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test the begin tool with advanced complexity
  const testRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "begin",
      arguments: {
        complexity: "advanced",
        workingDirectory: "/config/workspace/mcp-repl"
      }
    }
  };

  server.stdin.write(JSON.stringify(testRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check response
  try {
    const response = JSON.parse(testData.trim());
    if (response.result && response.result.content) {
      console.log('✅ Begin tool test successful');
      console.log('📋 Project Overview Response:');
      console.log(response.result.content[0].text);

      // Check for key features
      const text = response.result.content[0].text;
      if (text.includes('FILE BREAKDOWN') && text.includes('IMPORTS') && text.includes('EXPORTS')) {
        console.log('✅ Enhanced project overview features detected');
      } else {
        console.log('❌ Enhanced features not found');
      }
    } else {
      console.log('❌ Begin tool test failed');
      console.log('Response:', JSON.stringify(response, null, 2));
    }
  } catch (e) {
    console.log('❌ Response parsing failed:', e.message);
    console.log('Raw data:', testData);
  }

  server.kill();
  console.log('🎉 Project overview test completed');
}

testProjectOverview().catch(console.error);