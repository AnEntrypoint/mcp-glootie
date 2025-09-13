#!/usr/bin/env node
// MCP Handlers for Groundbreaking Tools
// High-performance, parallel execution handlers

import {
  projectAnalyze,
  gitIntelligence,
  fileNavigator,
  dependencyAnalyzer,
  performanceProfiler,
  qualityAnalyzer
} from './groundbreaking-tools.js';

// PROJECT ANALYZER Handler
export async function handleProjectAnalyze({ workingDirectory, depth = 'deep', focus = ['deps', 'architecture'] }) {
  try {
    // Validate working directory
    if (!workingDirectory) {
      throw new Error('workingDirectory parameter is required');
    }

    const startTime = Date.now();
    const result = await projectAnalyze(workingDirectory, depth, focus);
    const executionTime = Date.now() - startTime;

    return [{
      type: 'text',
      text: `🔍 PROJECT ANALYSIS COMPLETE (${executionTime}ms)

📊 **PROJECT METRICS**
• Files: ${result.metrics?.totalFiles || 0}
• Lines: ${result.metrics?.totalLines || 0}
• Dependencies: ${result.metrics?.dependencies || 0}
• Quality Score: ${result.metrics?.score || 0}/100
• Issues Found: ${result.metrics?.issues || 0}

🏗️ **ARCHITECTURE**
${JSON.stringify(result.analysis?.architecture || {}, null, 2)}

📦 **DEPENDENCIES**
${JSON.stringify(result.analysis?.dependencies || {}, null, 2)}

💡 **SUGGESTIONS**
${result.suggestions?.map(s => `• ${s}`).join('\n') || 'No issues detected'}

⚡ Analysis completed in ${executionTime}ms`
    }];

  } catch (error) {
    return [{
      type: 'text',
      text: `❌ Project analysis failed: ${error.message}`
    }];
  }
}

// GIT INTELLIGENCE Handler
export async function handleGitIntelligence({ workingDirectory, operation, path: filePath, limit = 20 }) {
  try {
    if (!workingDirectory || !operation) {
      throw new Error('workingDirectory and operation parameters are required');
    }

    const result = await gitIntelligence(workingDirectory, operation, filePath, limit);

    if (result.error) {
      return [{ type: 'text', text: `❌ Git operation failed: ${result.error}` }];
    }

    return [{
      type: 'text',
      text: `🔧 GIT ${operation.toUpperCase()} - ${result.repository}
${filePath ? `📁 Path: ${filePath}` : ''}

📋 **RESULTS**
${formatGitResults(operation, result.data)}

⏱️ Retrieved at ${result.timestamp}`
    }];

  } catch (error) {
    return [{
      type: 'text',
      text: `❌ Git intelligence failed: ${error.message}`
    }];
  }
}

// FILE NAVIGATOR Handler
export async function handleFileNavigator({ workingDirectory, view = 'tree', filter, depth = 3 }) {
  try {
    if (!workingDirectory) {
      throw new Error('workingDirectory parameter is required');
    }

    const result = await fileNavigator(workingDirectory, view, filter, depth);

    if (result.error) {
      return [{ type: 'text', text: `❌ File navigation failed: ${result.error}` }];
    }

    return [{
      type: 'text',
      text: `📁 FILE NAVIGATOR - ${view.toUpperCase()} VIEW
🌿 Root: ${result.root}
${filter ? `🔍 Filter: ${filter}` : ''}

📋 **STRUCTURE**
${formatFileResults(view, result.data)}

⏱️ Generated at ${result.timestamp}`
    }];

  } catch (error) {
    return [{
      type: 'text',
      text: `❌ File navigation failed: ${error.message}`
    }];
  }
}

// DEPENDENCY ANALYZER Handler
export async function handleDependencyAnalyzer({ workingDirectory, scope = 'all', format = 'list' }) {
  try {
    if (!workingDirectory) {
      throw new Error('workingDirectory parameter is required');
    }

    const result = await dependencyAnalyzer(workingDirectory, scope, format);

    if (result.error) {
      return [{ type: 'text', text: `❌ Dependency analysis failed: ${result.error}` }];
    }

    return [{
      type: 'text',
      text: `🔗 DEPENDENCY ANALYSIS - ${result.project}
📊 **METRICS**
• Total Packages: ${result.metrics?.totalPackages || 0}
• Internal Modules: ${result.metrics?.internalModules || 0}
• Circular References: ${result.metrics?.circularRefs || 0}
• Unused Dependencies: ${result.metrics?.unusedDeps || 0}

📦 **PACKAGE DEPENDENCIES**
${result.dependencies?.packages?.slice(0, 10).map(dep => `• ${dep}`).join('\n') || 'None found'}
${result.dependencies?.packages?.length > 10 ? `... and ${result.dependencies.packages.length - 10} more` : ''}

⚠️ **ISSUES DETECTED**
${result.issues?.map(issue => `• ${issue.type}: ${issue.description}`).join('\n') || 'No issues detected'}

⏱️ Analyzed at ${result.timestamp}`
    }];

  } catch (error) {
    return [{
      type: 'text',
      text: `❌ Dependency analysis failed: ${error.message}`
    }];
  }
}

// PERFORMANCE PROFILER Handler
export async function handlePerformanceProfiler({ workingDirectory, target, iterations = 1000, metrics = ['time'] }) {
  try {
    if (!workingDirectory || !target) {
      throw new Error('workingDirectory and target parameters are required');
    }

    const result = await performanceProfiler(workingDirectory, target, iterations, metrics);

    if (result.error) {
      return [{ type: 'text', text: `❌ Performance profiling failed: ${result.error}` }];
    }

    return [{
      type: 'text',
      text: `⚡ PERFORMANCE PROFILE - ${target}
🎯 Iterations: ${result.iterations}
📈 Metrics: ${metrics.join(', ')}

📊 **BENCHMARK RESULTS**
${formatBenchmarkResults(result.benchmark)}

💡 **INSIGHTS**
${result.insights?.map(insight => `• ${insight}`).join('\n') || 'No specific insights available'}

⏱️ Profiled at ${result.timestamp}`
    }];

  } catch (error) {
    return [{
      type: 'text',
      text: `❌ Performance profiling failed: ${error.message}`
    }];
  }
}

// QUALITY ANALYZER Handler
export async function handleQualityAnalyzer({ workingDirectory, scope = 'project', path: targetPath, metrics = ['complexity', 'maintainability'] }) {
  try {
    if (!workingDirectory) {
      throw new Error('workingDirectory parameter is required');
    }

    const result = await qualityAnalyzer(workingDirectory, scope, targetPath, metrics);

    if (result.error) {
      return [{ type: 'text', text: `❌ Quality analysis failed: ${result.error}` }];
    }

    return [{
      type: 'text',
      text: `🎯 CODE QUALITY ANALYSIS - ${scope.toUpperCase()}
${targetPath ? `📁 Path: ${targetPath}` : ''}

📊 **QUALITY SCORE: ${result.score?.overall || 0}/100**

📈 **METRICS**
• Complexity: ${result.metrics?.complexity?.average || 'N/A'}
• Maintainability: ${result.metrics?.maintainability?.score || 'N/A'}
• Test Coverage: ${result.metrics?.coverage?.percentage || 'N/A'}%

💡 **IMPROVEMENT SUGGESTIONS**
${result.suggestions?.map(suggestion => `• ${suggestion}`).join('\n') || 'Code quality looks good!'}

⏱️ Analyzed at ${result.timestamp}`
    }];

  } catch (error) {
    return [{
      type: 'text',
      text: `❌ Quality analysis failed: ${error.message}`
    }];
  }
}

// FORMATTING HELPER FUNCTIONS

function formatGitResults(operation, data) {
  if (!data) return 'No data available';

  if (typeof data === 'string') {
    // Format git output with proper line breaks and indentation
    return data.split('\n')
      .filter(line => line.trim())
      .slice(0, 20) // Limit output length
      .map(line => `  ${line}`)
      .join('\n');
  }

  return JSON.stringify(data, null, 2);
}

function formatFileResults(view, data) {
  if (!data) return 'No data available';

  switch (view) {
    case 'tree':
      return formatFileTree(data, 0);
    case 'flat':
      return data.slice(0, 30).map(file => `  📄 ${file}`).join('\n');
    case 'related':
      return Object.entries(data).slice(0, 10)
        .map(([file, related]) => `  📄 ${file} → ${related.length} related`)
        .join('\n');
    case 'changes':
      return data.map(change => `  ${change.status} ${change.file}`).join('\n');
    default:
      return JSON.stringify(data, null, 2);
  }
}

function formatFileTree(node, depth) {
  if (depth > 3) return ''; // Limit tree depth for readability

  let result = '';
  const indent = '  '.repeat(depth);

  if (typeof node === 'string') {
    return `${indent}📄 ${node}\n`;
  }

  if (node.children) {
    result += `${indent}📁 ${node.name}\n`;
    for (const child of node.children.slice(0, 5)) { // Limit children shown
      result += formatFileTree(child, depth + 1);
    }
    if (node.children.length > 5) {
      result += `${indent}  ... and ${node.children.length - 5} more items\n`;
    }
  }

  return result;
}

function formatBenchmarkResults(benchmark) {
  if (!benchmark) return 'No benchmark data available';

  return `• Average Time: ${benchmark.averageTime || 'N/A'}ms
• Min Time: ${benchmark.minTime || 'N/A'}ms
• Max Time: ${benchmark.maxTime || 'N/A'}ms
• Memory Usage: ${benchmark.memoryUsage || 'N/A'}MB
• CPU Usage: ${benchmark.cpuUsage || 'N/A'}%`;
}

// Export all handlers
export const groundbreakingHandlers = {
  project_analyze: handleProjectAnalyze,
  git_intelligence: handleGitIntelligence,
  file_navigator: handleFileNavigator,
  dependency_analyzer: handleDependencyAnalyzer,
  performance_profiler: handlePerformanceProfiler,
  quality_analyzer: handleQualityAnalyzer
};