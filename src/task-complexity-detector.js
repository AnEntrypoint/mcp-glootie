// Task complexity detection for appropriate tool selection
// Analyzes prompts and project context to determine optimal tool complexity

/**
 * Assess task complexity based on prompt and working directory
 * @param {string} prompt - The task prompt
 * @param {string} workingDirectory - The working directory path
 * @returns {Object} Complexity assessment with recommendations
 */
export function assessTaskComplexity(prompt, workingDirectory) {
  const complexityIndicators = {
    simple: [
      'create', 'write', 'add simple', 'basic', 'simple', 'hello world',
      'counter', 'test component', 'small function', 'add function',
      'create file', 'write code', 'basic operation'
    ],
    complex: [
      'search', 'analyze', 'refactor', 'optimize', 'migrate', 'transform',
      'pattern', 'structure', 'comprehensive', 'multiple files', 'project',
      'architecture', 'large scale', 'complex', 'advanced', 'sophisticated'
    ],
    batch: [
      'multiple', 'several', 'batch', 'all files', 'run several',
      'execute multiple', 'coordinate', 'sequence', 'pipeline'
    ]
  };

  // Analyze prompt for complexity indicators
  const promptLower = prompt.toLowerCase();
  let complexityScore = { simple: 0, complex: 0, batch: 0 };

  Object.keys(complexityIndicators).forEach(level => {
    complexityIndicators[level].forEach(indicator => {
      if (promptLower.includes(indicator)) {
        complexityScore[level]++;
      }
    });
  });

  // Determine primary complexity level
  const maxScore = Math.max(...Object.values(complexityScore));
  let complexityLevel = 'simple'; // default

  if (maxScore > 0) {
    if (complexityScore.complex >= complexityScore.batch && complexityScore.complex >= complexityScore.simple) {
      complexityLevel = 'complex';
    } else if (complexityScore.batch >= complexityScore.simple) {
      complexityLevel = 'batch';
    } else if (complexityScore.simple > 0) {
      complexityLevel = 'simple';
    }
  }

  // Analyze project context for additional complexity
  const projectComplexity = analyzeProjectComplexity(workingDirectory);

  // Adjust complexity based on project context
  if (projectComplexity === 'large' && complexityLevel === 'simple') {
    complexityLevel = 'complex'; // Even simple tasks in large projects need more care
  }

  return {
    complexityLevel,
    complexityScore,
    projectComplexity,
    recommendations: generateToolRecommendations(complexityLevel, projectComplexity),
    confidence: calculateConfidence(complexityScore, projectComplexity)
  };
}

/**
 * Analyze project complexity based on directory structure
 * @param {string} workingDirectory - The working directory path
 * @returns {string} Project complexity level
 */
function analyzeProjectComplexity(workingDirectory) {
  try {
    const fs = require('fs');
    const path = require('path');

    // Check if directory exists
    if (!fs.existsSync(workingDirectory)) {
      return 'unknown';
    }

    // Count files and directories
    const items = fs.readdirSync(workingDirectory);
    let fileCount = 0;
    let dirCount = 0;
    let hasComplexStructure = false;

    items.forEach(item => {
      const fullPath = path.join(workingDirectory, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        dirCount++;
        // Check for complex directory structures
        const complexDirs = ['src', 'lib', 'components', 'services', 'utils'];
        if (complexDirs.includes(item)) {
          hasComplexStructure = true;
        }
      } else if (stats.isFile()) {
        // Count relevant code files
        const ext = path.extname(item).toLowerCase();
        const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c'];
        if (codeExtensions.includes(ext)) {
          fileCount++;
        }
      }
    });

    // Determine project complexity
    if (fileCount > 50 || dirCount > 10 || hasComplexStructure) {
      return 'large';
    } else if (fileCount > 10 || dirCount > 3) {
      return 'medium';
    } else {
      return 'small';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Generate tool recommendations based on complexity
 * @param {string} complexityLevel - The assessed complexity level
 * @param {string} projectComplexity - The project complexity
 * @returns {Array} Recommended tools
 */
function generateToolRecommendations(complexityLevel, projectComplexity) {
  const recommendations = {
    simple: {
      small: ['Read', 'Edit', 'Write', 'Grep'],
      medium: ['Read', 'Edit', 'Write', 'Grep', 'searchcode'],
      large: ['Read', 'Edit', 'Write', 'searchcode'],
      unknown: ['Read', 'Edit', 'Write', 'Grep']
    },
    complex: {
      small: ['searchcode', 'astgrep_search', 'Read', 'Edit'],
      medium: ['searchcode', 'astgrep_search', 'astgrep_advanced_search', 'sequentialthinking'],
      large: ['astgrep_advanced_search', 'searchcode', 'sequentialthinking', 'batch_execute'],
      unknown: ['searchcode', 'astgrep_search', 'Read', 'Edit']
    },
    batch: {
      small: ['batch_execute', 'execute'],
      medium: ['batch_execute', 'execute', 'sequentialthinking'],
      large: ['batch_execute', 'sequentialthinking', 'astgrep_project'],
      unknown: ['batch_execute', 'execute']
    }
  };

  return recommendations[complexityLevel][projectComplexity] || recommendations[complexityLevel].unknown;
}

/**
 * Calculate confidence in the complexity assessment
 * @param {Object} complexityScore - Score object for each complexity level
 * @param {string} projectComplexity - The project complexity
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(complexityScore, projectComplexity) {
  const totalScore = Object.values(complexityScore).reduce((sum, score) => sum + score, 0);

  if (totalScore === 0) {
    // No clear indicators, rely on project complexity
    return projectComplexity === 'unknown' ? 0.3 : 0.6;
  }

  const maxScore = Math.max(...Object.values(complexityScore));
  const scoreRatio = maxScore / totalScore;

  // Adjust confidence based on project complexity knowledge
  const projectConfidence = projectComplexity === 'unknown' ? 0.7 : 0.9;

  return Math.min(scoreRatio * projectConfidence, 0.95);
}

/**
 * Get recommended tools for a given task
 * @param {string} prompt - The task prompt
 * @param {string} workingDirectory - The working directory
 * @returns {Object} Tool recommendations with reasoning
 */
export function getRecommendedTools(prompt, workingDirectory) {
  const assessment = assessTaskComplexity(prompt, workingDirectory);

  return {
    recommendedTools: assessment.recommendations,
    complexityLevel: assessment.complexityLevel,
    projectComplexity: assessment.projectComplexity,
    confidence: assessment.confidence,
    reasoning: generateReasoning(assessment),
    alternativeApproaches: generateAlternativeApproaches(assessment)
  };
}

/**
 * Generate reasoning for the recommendations
 * @param {Object} assessment - The complexity assessment
 * @returns {string} Reasoning explanation
 */
function generateReasoning(assessment) {
  const { complexityLevel, projectComplexity, complexityScore } = assessment;

  const reasons = [];

  if (complexityScore.simple > 0) {
    reasons.push(`Found ${complexityScore.simple} simple task indicators`);
  }
  if (complexityScore.complex > 0) {
    reasons.push(`Found ${complexityScore.complex} complex task indicators`);
  }
  if (complexityScore.batch > 0) {
    reasons.push(`Found ${complexityScore.batch} batch operation indicators`);
  }

  reasons.push(`Project complexity assessed as ${projectComplexity}`);

  return `Recommended ${complexityLevel} complexity tools because: ${reasons.join(', ')}.`;
}

/**
 * Generate alternative approaches
 * @param {Object} assessment - The complexity assessment
 * @returns {Array} Alternative approaches
 */
function generateAlternativeApproaches(assessment) {
  const alternatives = [];

  if (assessment.complexityLevel === 'simple') {
    alternatives.push({
      approach: 'Use MCP tools for enhanced functionality',
      reasoning: 'Even simple tasks can benefit from semantic search and AST analysis'
    });
  } else if (assessment.complexityLevel === 'complex') {
    alternatives.push({
      approach: 'Start with standard tools, escalate to MCP if needed',
      reasoning: 'Begin with Read/Edit/Grep, then use searchcode/astgrep for complex patterns'
    });
  }

  if (assessment.confidence < 0.7) {
    alternatives.push({
      approach: 'Provide both simple and complex tool options',
      reasoning: 'Low confidence in complexity assessment, offer choices'
    });
  }

  return alternatives;
}