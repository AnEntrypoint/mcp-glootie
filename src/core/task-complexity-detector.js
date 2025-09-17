

// Shared complexity indicators cache to avoid recreation on every call
const COMPLEXITY_INDICATORS = {
  simple: new Set([
    'create', 'write', 'add simple', 'basic', 'simple', 'hello world',
    'counter', 'test component', 'small function', 'add function',
    'create file', 'write code', 'basic operation'
  ]),
  complex: new Set([
    'search', 'analyze', 'refactor', 'optimize', 'migrate', 'transform',
    'pattern', 'structure', 'comprehensive', 'multiple files', 'project',
    'architecture', 'large scale', 'complex', 'advanced', 'sophisticated'
  ]),
  batch: new Set([
    'multiple', 'several', 'batch', 'all files', 'run several',
    'execute multiple', 'coordinate', 'sequence', 'pipeline'
  ])
};

// Cache for project complexity analysis with TTL (5 minutes)
const projectComplexityCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function assessTaskComplexity(prompt, workingDirectory) {
  const promptLower = prompt.toLowerCase();
  const complexityScore = { simple: 0, complex: 0, batch: 0 };

  // Optimized single-pass scoring with Set.has() instead of array.includes()
  for (const [level, indicators] of Object.entries(COMPLEXITY_INDICATORS)) {
    for (const indicator of indicators) {
      if (promptLower.includes(indicator)) {
        complexityScore[level]++;
      }
    }
  }

  // Optimized complexity level determination with single pass
  let complexityLevel = 'simple';
  const maxScore = Math.max(complexityScore.simple, complexityScore.complex, complexityScore.batch);

  if (maxScore > 0) {
    if (complexityScore.complex >= complexityScore.batch && complexityScore.complex >= complexityScore.simple) {
      complexityLevel = 'complex';
    } else if (complexityScore.batch >= complexityScore.simple) {
      complexityLevel = 'batch';
    }
  }

  const projectComplexity = analyzeProjectComplexity(workingDirectory);

  if (projectComplexity === 'large' && complexityLevel === 'simple') {
    complexityLevel = 'complex';
  }

  return {
    complexityLevel,
    complexityScore,
    projectComplexity,
    recommendations: generateToolRecommendations(complexityLevel, projectComplexity),
    confidence: calculateConfidence(complexityScore, projectComplexity)
  };
}

// Optimized project complexity analysis with caching
function analyzeProjectComplexity(workingDirectory) {
  const cacheKey = workingDirectory;
  const now = Date.now();

  // Check cache first
  const cached = projectComplexityCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }

  try {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(workingDirectory)) {
      return 'unknown';
    }

    const items = fs.readdirSync(workingDirectory);
    let fileCount = 0;
    let dirCount = 0;
    let hasComplexStructure = false;

    // Pre-define sets for faster lookups
    const complexDirs = new Set(['src', 'lib', 'components', 'services', 'utils']);
    const codeExtensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c']);

    for (const item of items) {
      const fullPath = path.join(workingDirectory, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        dirCount++;

        if (complexDirs.has(item)) {
          hasComplexStructure = true;
        }
      } else if (stats.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (codeExtensions.has(ext)) {
          fileCount++;
        }
      }
    }

    let result;
    if (fileCount > 50 || dirCount > 10 || hasComplexStructure) {
      result = 'large';
    } else if (fileCount > 10 || dirCount > 3) {
      result = 'medium';
    } else {
      result = 'small';
    }

    // Cache the result
    projectComplexityCache.set(cacheKey, { result, timestamp: now });

    return result;
  } catch (error) {
    return 'unknown';
  }
}

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

// Optimized confidence calculation with reduced object operations
function calculateConfidence(complexityScore, projectComplexity) {
  const totalScore = complexityScore.simple + complexityScore.complex + complexityScore.batch;

  if (totalScore === 0) {
    return projectComplexity === 'unknown' ? 0.3 : 0.6;
  }

  const maxScore = Math.max(complexityScore.simple, complexityScore.complex, complexityScore.batch);
  const scoreRatio = maxScore / totalScore;
  const projectConfidence = projectComplexity === 'unknown' ? 0.7 : 0.9;

  return Math.min(scoreRatio * projectConfidence, 0.95);
}

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