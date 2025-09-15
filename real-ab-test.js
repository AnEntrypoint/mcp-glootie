#!/usr/bin/env node

// REAL A/B Testing Program for MCP Glootie v3.1.0
// Actually runs claude -p commands on real boilerplate projects
// No simulation - real execution with real timing

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

class RealABTestSuite {
  constructor() {
    this.results = {
      withGlootie: [],
      withoutGlootie: [],
      comparisons: [],
      timestamp: new Date().toISOString(),
      version: '3.1.0',
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };

    // Real test scenarios using actual boilerplate projects
    this.testScenarios = [
      {
        id: 'password-validation',
        name: 'Add Password Validation',
        description: 'Add password strength validation to React auth form',
        projectDir: './test-boilerplate/nextjs-app',
        targetFile: 'src/app/page.tsx',
        prompt: 'Add password strength validation to the React auth form. Include requirements: minimum 8 characters, at least one uppercase letter, one number, and one special character. Show validation errors to the user.',
        category: 'frontend',
        difficulty: 'medium'
      },
      {
        id: 'express-auth',
        name: 'Add Authentication to Express API',
        description: 'Add JWT authentication middleware to Express API',
        projectDir: './test-boilerplate/express-api',
        targetFile: 'app.js',
        prompt: 'Add JWT authentication middleware to this Express API. Include login endpoint, token validation, and protected routes. Use jsonwebtoken package.',
        category: 'backend',
        difficulty: 'medium'
      },
      {
        id: 'refactor-callbacks',
        name: 'Refactor Callbacks to Promises',
        description: 'Convert callback-based functions to Promise-based',
        projectDir: './test-boilerplate/express-api',
        targetFile: 'app.js',
        prompt: 'Refactor any callback-based functions in this Express app to use Promises instead. Make the code more modern and maintainable.',
        category: 'refactoring',
        difficulty: 'easy'
      }
    ];
  }

  // Run claude -p command and return results
  async runClaudeCommand(prompt, workingDir, useMcp = true) {
    const startTime = Date.now();
    const tempFile = path.join(workingDir, 'claude-task.md');

    try {
      // Write prompt to temp file
      fs.writeFileSync(tempFile, prompt);

      // Build claude command
      const claudeCmd = useMcp
        ? `claude -p "${prompt}" --mcp glootie`
        : `claude -p "${prompt}"`;

      console.log(`\n🤖 Running: ${claudeCmd}`);
      console.log(`📁 Working directory: ${workingDir}`);

      // Execute claude command
      const output = execSync(claudeCmd, {
        cwd: workingDir,
        timeout: 300000, // 5 minutes
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      return {
        success: true,
        duration: duration,
        output: output,
        outputLength: output.length,
        usedMcp: useMcp
      };

    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }

      return {
        success: false,
        duration: duration,
        error: error.message,
        output: error.stdout || '',
        outputLength: error.stdout ? error.stdout.length : 0,
        usedMcp: useMcp
      };
    }
  }

  // Backup original files
  backupFiles(projectDir, filesToBackup) {
    const backups = {};
    for (const file of filesToBackup) {
      const filePath = path.join(projectDir, file);
      if (fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        fs.copyFileSync(filePath, backupPath);
        backups[file] = backupPath;
      }
    }
    return backups;
  }

  // Restore files from backup
  restoreFiles(backups) {
    for (const [originalFile, backupPath] of Object.entries(backups)) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, originalFile);
        fs.unlinkSync(backupPath);
      }
    }
  }

  // Run a single test scenario
  async runTestScenario(scenario) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`   📁 Project: ${scenario.projectDir}`);

    // Backup original files
    const backups = this.backupFiles(scenario.projectDir, [scenario.targetFile]);

    try {
      // Test WITHOUT MCP Glootie
      console.log(`   🔍 Testing WITHOUT MCP...`);
      const withoutMcpResult = await this.runClaudeCommand(
        scenario.prompt,
        scenario.projectDir,
        false
      );

      // Restore files for clean test
      this.restoreFiles(backups);

      // Test WITH MCP Glootie
      console.log(`   🔍 Testing WITH MCP...`);
      const withMcpResult = await this.runClaudeCommand(
        scenario.prompt,
        scenario.projectDir,
        true
      );

      // Calculate comparison metrics
      const comparison = {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        category: scenario.category,
        withoutMcp: withoutMcpResult,
        withMcp: withMcpResult,
        timeSavings: withoutMcpResult.duration - withMcpResult.duration,
        timeSavingsPercent: ((withoutMcpResult.duration - withMcpResult.duration) / withoutMcpResult.duration * 100).toFixed(1),
        outputEfficiency: withMcpResult.outputLength > withoutMcpResult.outputLength ? 'better' : 'worse'
      };

      console.log(`   📊 RESULTS:`);
      console.log(`      Without MCP: ${withoutMcpResult.duration.toFixed(1)}s (${withoutMcpResult.success ? '✅' : '❌'})`);
      console.log(`      With MCP: ${withMcpResult.duration.toFixed(1)}s (${withMcpResult.success ? '✅' : '❌'})`);
      console.log(`      Time savings: ${comparison.timeSavingsPercent}%`);

      // Store results
      this.results.withoutGlootie.push(withoutMcpResult);
      this.results.withGlootie.push(withMcpResult);
      this.results.comparisons.push(comparison);

      return comparison;

    } finally {
      // Always restore files
      this.restoreFiles(backups);
    }
  }

  // Run all test scenarios
  async runAllTests() {
    console.log('🔬 REAL A/B TESTING - MCP Glootie v3.1.0');
    console.log('='.repeat(60));
    console.log('Actually running claude -p commands on real projects');
    console.log('No simulation - real execution, real timing\n');

    for (const scenario of this.testScenarios) {
      try {
        await this.runTestScenario(scenario);
      } catch (error) {
        console.error(`❌ Test failed for ${scenario.id}:`, error.message);
      }
    }

    this.generateReport();
  }

  // Generate comprehensive report
  generateReport() {
    const successfulTests = this.results.comparisons.filter(c =>
      c.withMcp.success && c.withoutMcp.success
    );

    const avgTimeWithout = successfulTests.reduce((sum, c) => sum + c.withoutMcp.duration, 0) / successfulTests.length || 0;
    const avgTimeWith = successfulTests.reduce((sum, c) => sum + c.withMcp.duration, 0) / successfulTests.length || 0;
    const avgTimeSavings = ((avgTimeWithout - avgTimeWith) / avgTimeWithout * 100).toFixed(1);

    const report = {
      summary: {
        totalTests: this.testScenarios.length,
        successfulTests: successfulTests.length,
        averageTimeWithoutMcp: avgTimeWithout.toFixed(1),
        averageTimeWithMcp: avgTimeWith.toFixed(1),
        averageTimeSavings: avgTimeSavings,
        mcpSuccessRate: (this.results.withGlootie.filter(r => r.success).length / this.results.withGlootie.length * 100).toFixed(1),
        baselineSuccessRate: (this.results.withoutGlootie.filter(r => r.success).length / this.results.withoutGlootie.length * 100).toFixed(1)
      },
      detailedResults: this.results,
      generatedAt: new Date().toISOString()
    };

    // Save report
    const reportFile = `real-ab-results-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log('\n📈 FINAL REPORT');
    console.log('='.repeat(50));
    console.log(`✅ Successful tests: ${successfulTests.length}/${this.testScenarios.length}`);
    console.log(`⏱️  Average time without MCP: ${avgTimeWithout.toFixed(1)}s`);
    console.log(`⏱️  Average time with MCP: ${avgTimeWith.toFixed(1)}s`);
    console.log(`💰 Time savings: ${avgTimeSavings}%`);
    console.log(`🎯 MCP success rate: ${report.summary.mcpSuccessRate}%`);
    console.log(`📊 Report saved to: ${reportFile}`);

    return report;
  }
}

// Main execution
async function main() {
  const testSuite = new RealABTestSuite();

  try {
    await testSuite.runAllTests();
  } catch (error) {
    console.error('❌ A/B testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = RealABTestSuite;