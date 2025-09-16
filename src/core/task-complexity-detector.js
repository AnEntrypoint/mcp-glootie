

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

  const promptLower = prompt.toLowerCase();
  let complexityScore = { simple: 0, complex: 0, batch: 0 };

  Object.keys(complexityIndicators).forEach(level => {
    complexityIndicators[level].forEach(indicator => {
      if (promptLower.includes(indicator)) {
        complexityScore[level]++;
      }
    });
  });

  const maxScore = Math.max(...Object.values(complexityScore));
  let complexityLevel = 'simple'; 

  if (maxScore > 0) {
    if (complexityScore.complex >= complexityScore.batch && complexityScore.complex >= complexityScore.simple) {
      complexityLevel = 'complex';
    } else if (complexityScore.batch >= complexityScore.simple) {
      complexityLevel = 'batch';
    } else if (complexityScore.simple > 0) {
      complexityLevel = 'simple';
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

function analyzeProjectComplexity(workingDirectory) {
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

    items.forEach(item => {
      const fullPath = path.join(workingDirectory, item);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        dirCount++;
        
        const complexDirs = ['src', 'lib', 'components', 'services', 'utils'];
        if (complexDirs.includes(item)) {
          hasComplexStructure = true;
        }
      } else if (stats.isFile()) {
        
        const ext = path.extname(item).toLowerCase();
        const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c'];
        if (codeExtensions.includes(ext)) {
          fileCount++;
        }
      }
    });

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

function calculateConfidence(complexityScore, projectComplexity) {
  const totalScore = Object.values(complexityScore).reduce((sum, score) => sum + score, 0);

  if (totalScore === 0) {
    
    return projectComplexity === 'unknown' ? 0.3 : 0.6;
  }

  const maxScore = Math.max(...Object.values(complexityScore));
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