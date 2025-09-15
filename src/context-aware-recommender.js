// Context-aware tool recommendation system
// Provides intelligent tool suggestions based on project context and task analysis

import { getRecommendedTools } from './task-complexity-detector.js';
import { analyzeProjectComplexity } from './task-complexity-detector.js';

/**
 * Analyze project context for tool recommendations
 * @param {string} workingDirectory - Working directory path
 * @returns {Object} Project context analysis
 */
export function analyzeProjectContext(workingDirectory) {
  try {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(workingDirectory)) {
      return {
        type: 'unknown',
        confidence: 0,
        technologies: [],
        patterns: [],
        recommendation: 'standard'
      };
    }

    const analysis = {
      files: [],
      directories: [],
      technologies: new Set(),
      patterns: new Set(),
      complexity: 'unknown'
    };

    // Scan directory structure
    const scanDirectory = (dir, depth = 0) => {
      if (depth > 3) return; // Limit depth for performance

      try {
        const items = fs.readdirSync(dir);

        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory() && !item.startsWith('.')) {
            analysis.directories.push({
              name: item,
              path: fullPath,
              depth: depth + 1
            });
            scanDirectory(fullPath, depth + 1);
          } else if (stats.isFile()) {
            const ext = path.extname(item).toLowerCase();
            const name = item.toLowerCase();

            analysis.files.push({
              name: item,
              extension: ext,
              path: fullPath,
              size: stats.size
            });

            // Detect technologies
            detectTechnologies(name, ext, analysis.technologies);

            // Detect patterns
            detectPatterns(name, analysis.patterns);
          }
        });
      } catch (error) {
        // Silently handle permission errors
      }
    };

    scanDirectory(workingDirectory);

    // Determine project type
    const projectType = determineProjectType(analysis);

    // Assess complexity
    analysis.complexity = analyzeProjectComplexity(workingDirectory);

    return {
      type: projectType,
      confidence: calculateProjectConfidence(analysis),
      technologies: Array.from(analysis.technologies),
      patterns: Array.from(analysis.patterns),
      complexity: analysis.complexity,
      fileCount: analysis.files.length,
      directoryCount: analysis.directories.length,
      analysis: analysis
    };

  } catch (error) {
    return {
      type: 'unknown',
      confidence: 0,
      technologies: [],
      patterns: [],
      complexity: 'unknown',
      error: error.message
    };
  }
}

/**
 * Detect technologies based on file names and extensions
 * @param {string} fileName - File name
 * @param {string} extension - File extension
 * @param {Set} technologies - Set to add detected technologies to
 */
function detectTechnologies(fileName, extension, technologies) {
  const techMap = {
    // JavaScript/TypeScript
    '.js': ['JavaScript', 'Node.js'],
    '.ts': ['TypeScript', 'Node.js'],
    '.jsx': ['React', 'JavaScript'],
    '.tsx': ['React', 'TypeScript'],
    '.mjs': ['ES Module', 'JavaScript'],
    '.cjs': ['CommonJS', 'JavaScript'],

    // Python
    '.py': ['Python'],
    '.pyw': ['Python'],

    // Java
    '.java': ['Java'],

    // Go
    '.go': ['Go'],

    // Rust
    '.rs': ['Rust'],

    // C/C++
    '.c': ['C'],
    '.cpp': ['C++'],
    '.h': ['C/C++'],

    // Web
    '.html': ['HTML', 'Web'],
    '.css': ['CSS', 'Web'],
    '.scss': ['SCSS', 'CSS'],
    '.less': ['LESS', 'CSS'],

    // Configuration
    'package.json': ['Node.js', 'npm'],
    'yarn.lock': ['Node.js', 'yarn'],
    'pnpm-lock.yaml': ['Node.js', 'pnpm'],
    'requirements.txt': ['Python', 'pip'],
    'go.mod': ['Go', 'Modules'],
    'Cargo.toml': ['Rust', 'Cargo'],
    'pom.xml': ['Java', 'Maven'],
    'build.gradle': ['Java', 'Gradle'],

    // Frameworks
    'next.config.js': ['Next.js', 'React'],
    'nuxt.config.js': ['Nuxt.js', 'Vue'],
    'vue.config.js': ['Vue'],
    'angular.json': ['Angular'],
    'svelte.config.js': ['Svelte'],

    // Testing
    'jest.config.js': ['Jest'],
    'cypress.config.js': ['Cypress'],
    'playwright.config.js': ['Playwright'],
    'vitest.config.js': ['Vitest'],

    // Build tools
    'webpack.config.js': ['Webpack'],
    'vite.config.js': ['Vite'],
    'rollup.config.js': ['Rollup'],

    // Type checking
    'tsconfig.json': ['TypeScript'],
    'jsconfig.json': ['JavaScript']
  };

  // Check by file name
  if (techMap[fileName.toLowerCase()]) {
    techMap[fileName.toLowerCase()].forEach(tech => technologies.add(tech));
  }

  // Check by extension
  if (techMap[extension]) {
    techMap[extension].forEach(tech => technologies.add(tech));
  }

  // Additional pattern-based detection
  if (fileName.includes('test') || fileName.includes('spec')) {
    technologies.add('Testing');
  }

  if (fileName.includes('config') || fileName.includes('.config.')) {
    technologies.add('Configuration');
  }
}

/**
 * Detect patterns based on file names
 * @param {string} fileName - File name
 * @param {Set} patterns - Set to add detected patterns to
 */
function detectPatterns(fileName, patterns) {
  const patternMap = {
    'api': ['API'],
    'service': ['Service', 'Backend'],
    'controller': ['Controller', 'MVC'],
    'model': ['Model', 'MVC', 'Database'],
    'view': ['View', 'MVC', 'UI'],
    'component': ['Component', 'UI'],
    'util': ['Utility', 'Helper'],
    'helper': ['Helper', 'Utility'],
    'middleware': ['Middleware', 'Backend'],
    'route': ['Routing', 'Backend'],
    'handler': ['Handler', 'Backend'],
    'repository': ['Repository', 'Database'],
    'entity': ['Entity', 'Database'],
    'dto': ['DTO', 'Data Transfer'],
    'interface': ['Interface', 'TypeScript'],
    'type': ['Type', 'TypeScript'],
    'enum': ['Enum', 'TypeScript'],
    'class': ['Class', 'OOP'],
    'function': ['Function', 'Programming'],
    'constant': ['Constant', 'Configuration'],
    'config': ['Configuration'],
    'index': ['Index', 'Export'],
    'main': ['Entry Point', 'Main'],
    'app': ['Application', 'Main'],
    'server': ['Server', 'Backend'],
    'client': ['Client', 'Frontend'],
    'auth': ['Authentication', 'Security'],
    'auth': ['Authorization', 'Security'],
    'user': ['User', 'Authentication'],
    'admin': ['Admin', 'Management'],
    'dashboard': ['Dashboard', 'UI'],
    'layout': ['Layout', 'UI'],
    'style': ['Style', 'CSS'],
    'script': ['Script', 'JavaScript'],
    'test': ['Testing'],
    'spec': ['Testing', 'Specification'],
    'mock': ['Testing', 'Mock'],
    'stub': ['Testing', 'Stub'],
    'fixture': ['Testing', 'Fixture']
  };

  Object.keys(patternMap).forEach(pattern => {
    if (fileName.toLowerCase().includes(pattern)) {
      patternMap[pattern].forEach(detectedPattern => patterns.add(detectedPattern));
    }
  });
}

/**
 * Determine project type based on analysis
 * @param {Object} analysis - Project analysis
 * @returns {string} Project type
 */
function determineProjectType(analysis) {
  const technologies = analysis.technologies;
  const patterns = analysis.patterns;

  // Check for specific project types
  if (technologies.includes('React') && technologies.includes('Next.js')) {
    return 'nextjs';
  }

  if (technologies.includes('React') && !technologies.includes('Next.js')) {
    return 'react';
  }

  if (technologies.includes('Vue')) {
    return 'vue';
  }

  if (technologies.includes('Angular')) {
    return 'angular';
  }

  if (technologies.includes('Svelte')) {
    return 'svelte';
  }

  if (technologies.includes('Node.js') && patterns.includes('API')) {
    return 'node-api';
  }

  if (technologies.includes('Node.js')) {
    return 'nodejs';
  }

  if (technologies.includes('Python')) {
    return 'python';
  }

  if (technologies.includes('Java')) {
    return 'java';
  }

  if (technologies.includes('Go')) {
    return 'go';
  }

  if (technologies.includes('Rust')) {
    return 'rust';
  }

  if (technologies.includes('TypeScript')) {
    return 'typescript';
  }

  if (technologies.includes('JavaScript')) {
    return 'javascript';
  }

  // Check for web project
  if (technologies.includes('HTML') || technologies.includes('CSS')) {
    return 'web';
  }

  return 'generic';
}

/**
 * Calculate project type confidence
 * @param {Object} analysis - Project analysis
 * @returns {number} Confidence score (0-1)
 */
function calculateProjectConfidence(analysis) {
  const techCount = analysis.technologies.size;
  const patternCount = analysis.patterns.size;
  const fileCount = analysis.files.length;

  // Base confidence on technology diversity
  let confidence = Math.min(techCount / 5, 1) * 0.4; // 40% weight on technologies
  confidence += Math.min(patternCount / 10, 1) * 0.3; // 30% weight on patterns
  confidence += Math.min(fileCount / 20, 1) * 0.3; // 30% weight on file count

  return Math.min(confidence, 1);
}

/**
 * Get context-aware tool recommendations
 * @param {string} taskPrompt - Task description
 * @param {string} workingDirectory - Working directory
 * @returns {Object} Context-aware recommendations
 */
export function getContextAwareRecommendations(taskPrompt, workingDirectory) {
  // Get basic task complexity assessment
  const taskAssessment = getRecommendedTools(taskPrompt, workingDirectory);

  // Get project context analysis
  const projectContext = analyzeProjectContext(workingDirectory);

  // Generate enhanced recommendations
  const enhancedRecommendations = generateEnhancedRecommendations(
    taskAssessment,
    projectContext,
    taskPrompt
  );

  return {
    taskComplexity: taskAssessment.complexityLevel,
    projectType: projectContext.type,
    projectComplexity: projectContext.complexity,
    confidence: taskAssessment.confidence * projectContext.confidence,
    recommendedTools: enhancedRecommendations.tools,
    reasoning: enhancedRecommendations.reasoning,
    alternatives: enhancedRecommendations.alternatives,
    context: {
      technologies: projectContext.technologies,
      patterns: projectContext.patterns,
      fileCount: projectContext.fileCount,
      directoryCount: projectContext.directoryCount
    }
  };
}

/**
 * Generate enhanced recommendations based on context
 * @param {Object} taskAssessment - Task complexity assessment
 * @param {Object} projectContext - Project context analysis
 * @param {string} taskPrompt - Original task prompt
 * @returns {Object} Enhanced recommendations
 */
function generateEnhancedRecommendations(taskAssessment, projectContext, taskPrompt) {
  const baseTools = taskAssessment.recommendedTools || [];
  const enhancedTools = [...baseTools];
  const reasoning = [];
  const alternatives = [];

  // Enhance based on project type
  switch (projectContext.type) {
    case 'nextjs':
    case 'react':
      if (taskAssessment.complexityLevel === 'complex') {
        enhancedTools.push('astgrep_search', 'astgrep_advanced_search');
        reasoning.push('React/Next.js projects benefit from AST pattern matching');
      }
      break;

    case 'node-api':
      enhancedTools.push('searchcode', 'execute');
      reasoning.push('API projects need code search and execution capabilities');
      break;

    case 'python':
    case 'java':
      enhancedTools.push('searchcode');
      reasoning.push('Compiled/interpreted languages benefit from semantic search');
      break;

    case 'typescript':
      enhancedTools.push('astgrep_search', 'astgrep_lint');
      reasoning.push('TypeScript projects benefit from type-aware AST analysis');
      break;
  }

  // Enhance based on project complexity
  if (projectContext.complexity === 'large') {
    enhancedTools.push('batch_execute', 'sequentialthinking');
    reasoning.push('Large projects benefit from batch operations and structured thinking');
  }

  // Enhance based on project technologies
  if (projectContext.technologies.includes('Testing')) {
    enhancedTools.push('astgrep_lint');
    reasoning.push('Projects with testing benefit from code validation');
  }

  // Remove duplicates while preserving order
  const uniqueTools = [...new Set(enhancedTools)];

  // Generate alternatives
  if (taskAssessment.confidence < 0.7) {
    alternatives.push({
      approach: 'Provide both simple and complex tool options',
      reasoning: 'Low confidence in task complexity assessment'
    });
  }

  if (projectContext.confidence < 0.5) {
    alternatives.push({
      approach: 'Use general-purpose tools first',
      reasoning: 'Limited project context information available'
    });
  }

  return {
    tools: uniqueTools,
    reasoning: reasoning.join('. '),
    alternatives: alternatives
  };
}

/**
 * Format recommendations for user display
 * @param {Object} recommendations - Context-aware recommendations
 * @returns {string} Formatted recommendations
 */
export function formatRecommendations(recommendations) {
  let formatted = `🎯 Context-Aware Tool Recommendations\n\n`;

  formatted += `Task Complexity: ${recommendations.taskComplexity}\n`;
  formatted += `Project Type: ${recommendations.projectType}\n`;
  formatted += `Project Complexity: ${recommendations.projectComplexity}\n`;
  formatted += `Confidence: ${Math.round(recommendations.confidence * 100)}%\n\n`;

  formatted += `Recommended Tools:\n`;
  recommendations.recommendedTools.forEach((tool, index) => {
    formatted += `${index + 1}. ${tool}\n`;
  });

  if (recommendations.reasoning) {
    formatted += `\nReasoning: ${recommendations.reasoning}\n`;
  }

  if (recommendations.context.technologies.length > 0) {
    formatted += `\nDetected Technologies: ${recommendations.context.technologies.join(', ')}\n`;
  }

  if (recommendations.alternatives.length > 0) {
    formatted += `\nAlternative Approaches:\n`;
    recommendations.alternatives.forEach((alt, index) => {
      formatted += `${index + 1}. ${alt.approach} - ${alt.reasoning}\n`;
    });
  }

  return formatted;
}