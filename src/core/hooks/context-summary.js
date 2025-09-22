#!/usr/bin/env node

// Hook for displaying context summary and status
import { getContextSummary, getContextPatterns } from './context-store.js';

console.log('📊 CONTEXT SUMMARY - Hook-based context status...');

// Generate context info summary
function generateContextInfo() {
  const summary = getContextSummary();
  const patterns = getContextPatterns();

  let contextInfo = `\n📊 HOOK CONTEXT STATUS:\n`;
  contextInfo += `   • Cached analyses: ${summary.totalAnalyses}\n`;
  contextInfo += `   • Known patterns: ${summary.totalPatterns}\n`;
  contextInfo += `   • Search cache: ${summary.cachedSearches}\n`;
  contextInfo += `   • Last update: ${new Date(summary.lastUpdate).toLocaleString()}\n\n`;

  contextInfo += `💾 MEMORY USAGE:\n`;
  contextInfo += `   • Analyses: ${summary.memoryUsage.analyses}\n`;
  contextInfo += `   • Patterns: ${summary.memoryUsage.patterns}\n`;
  contextInfo += `   • Search cache: ${summary.memoryUsage.searchCache}\n\n`;

  if (patterns.length > 0) {
    contextInfo += `🔍 ACTIVE PATTERNS:\n`;
    patterns.slice(0, 10).forEach(pattern => {
      contextInfo += `   • ${pattern}\n`;
    });
    if (patterns.length > 10) {
      contextInfo += `   • ... and ${patterns.length - 10} more patterns\n`;
    }
    contextInfo += `\n`;
  }

  return contextInfo;
}

// Generate tool recommendations
function generateToolRecommendations() {
  let recommendations = `🛠️ AVAILABLE TOOLS & RECOMMENDATIONS:\n\n`;

  recommendations += `PRIMARY TOOL:\n`;
  recommendations += `   • execute: Test code hypotheses and validate approaches\n\n`;

  recommendations += `SEMANTIC SEARCH & ANALYSIS:\n`;
  recommendations += `   • searchcode: Find patterns, understand codebase structure\n`;
  recommendations += `   • ast_tool: Direct ast-grep access for code transformations\n\n`;

  recommendations += `HOOK-BASED AUTO-LINTING:\n`;
  recommendations += `   • All file edits automatically trigger linting\n`;
  recommendations += `   • Real-time feedback on code quality\n`;
  recommendations += `   • Lightweight context management\n\n`;

  recommendations += `HOOK FEATURES:\n`;
  recommendations += `   • Context updates on file changes\n`;
  recommendations += `   • Pre-save/commit linting validation\n`;
  recommendations += `   • Project structure discovery\n`;
  recommendations += `   • Automatic cleanup and memory management\n\n`;

  recommendations += `BEST PRACTICES:\n`;
  recommendations += `   • Test hypotheses with execute before implementation\n`;
  recommendations += `   • Use searchcode for understanding existing patterns\n`;
  recommendations += `   • Leverage ast_tool for precise code transformations\n`;
  recommendations += `   • Build on existing code structure and conventions\n`;

  return recommendations;
}

// Main execution
try {
  const contextInfo = generateContextInfo();
  const recommendations = generateToolRecommendations();

  console.log(contextInfo);
  console.log(recommendations);
  console.log(`✅ CONTEXT SUMMARY COMPLETE`);

} catch (error) {
  console.log(`❌ CONTEXT SUMMARY ERROR: ${error.message}`);
}