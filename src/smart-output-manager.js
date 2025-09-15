// Smart output management with progressive disclosure
// Provides context-aware output sizing and intelligent content presentation

import { estimateTokens } from './output-truncation.js';
import { assessTaskComplexity } from './task-complexity-detector.js';

/**
 * Configure output settings based on task complexity and content
 * @param {Object} content - The content to be output
 * @param {string} taskPrompt - The original task prompt
 * @param {string} workingDirectory - Working directory
 * @returns {Object} Output configuration
 */
export function configureOutput(content, taskPrompt, workingDirectory) {
  const complexity = assessTaskComplexity(taskPrompt, workingDirectory);
  const contentSize = calculateContentSize(content);

  const outputConfig = {
    simple: { maxTokens: 5000, truncate: true, progressive: false },
    complex: { maxTokens: 15000, truncate: false, progressive: true },
    production: { maxTokens: 25000, truncate: false, progressive: true, enableOverflow: true }
  };

  const config = outputConfig[complexity.complexityLevel] || outputConfig.simple;

  // Adjust based on content size
  if (contentSize > config.maxTokens * 1.5) {
    config.progressive = true;
    config.enableOverflow = true;
  }

  return {
    ...config,
    complexityLevel: complexity.complexityLevel,
    confidence: complexity.confidence,
    estimatedTokens: contentSize
  };
}

/**
 * Calculate content size in tokens
 * @param {Object} content - MCP content object
 * @returns {number} Estimated token count
 */
function calculateContentSize(content) {
  if (!content) return 0;

  if (Array.isArray(content)) {
    return content.reduce((total, item) => {
      return total + estimateTokens(JSON.stringify(item));
    }, 0);
  }

  return estimateTokens(JSON.stringify(content));
}

/**
 * Provide progressive disclosure for large content
 * @param {Object} content - Original content
 * @param {Object} config - Output configuration
 * @returns {Object} Progressively disclosed content
 */
export function provideProgressiveOutput(content, config) {
  if (!config.progressive || config.estimatedTokens <= config.maxTokens) {
    return content;
  }

  const summary = generateContentSummary(content);
  const keySections = extractKeySections(content);
  const isLargeContent = config.estimatedTokens > config.maxTokens;

  return {
    summary,
    keySections,
    fullContentAvailable: isLargeContent,
    estimatedSize: `${Math.round(config.estimatedTokens)} tokens`,
    compressionRatio: calculateCompressionRatio(content, summary, keySections),
    navigation: generateNavigationInfo(content, config),
    originalContent: isLargeContent ? null : content
  };
}

/**
 * Generate a summary of the content
 * @param {Object} content - Original content
 * @returns {Object} Content summary
 */
function generateContentSummary(content) {
  if (!content) return { text: "No content available" };

  let summaryText = "";
  let itemCount = 0;
  let totalLines = 0;

  if (Array.isArray(content)) {
    itemCount = content.length;
    summaryText = `Contains ${itemCount} items`;

    // Analyze content types
    const types = {};
    content.forEach(item => {
      const type = item.type || 'unknown';
      types[type] = (types[type] || 0) + 1;

      if (item.text) {
        totalLines += item.text.split('\n').length;
      }
    });

    const typeSummary = Object.entries(types)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');

    summaryText += ` (${typeSummary})`;
  } else {
    summaryText = "Single content item";
    if (content.text) {
      totalLines = content.text.split('\n').length;
    }
  }

  return {
    text: summaryText,
    itemCount,
    totalLines,
    estimatedReadingTime: Math.ceil(totalLines / 50) // Rough estimate
  };
}

/**
 * Extract key sections from content
 * @param {Object} content - Original content
 * @returns {Array} Key sections
 */
function extractKeySections(content) {
  if (!content) return [];

  const sections = [];

  if (Array.isArray(content)) {
    content.slice(0, 5).forEach((item, index) => {
      if (item.type === 'text' && item.text) {
        const lines = item.text.split('\n');
        const preview = lines.slice(0, 10).join('\n'); // First 10 lines

        sections.push({
          index,
          type: item.type,
          preview: preview.length < 500 ? preview : preview.substring(0, 500) + '...',
          fullLines: lines.length,
          importance: calculateImportance(item.text)
        });
      }
    });
  } else if (content.type === 'text' && content.text) {
    const lines = content.text.split('\n');
    const preview = lines.slice(0, 10).join('\n');

    sections.push({
      index: 0,
      type: content.type,
      preview: preview.length < 500 ? preview : preview.substring(0, 500) + '...',
      fullLines: lines.length,
      importance: calculateImportance(content.text)
    });
  }

  // Sort by importance and take top sections
  return sections
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
}

/**
 * Calculate importance of content section
 * @param {string} text - Text content
 * @returns {number} Importance score (0-1)
 */
function calculateImportance(text) {
  if (!text) return 0;

  const importanceIndicators = {
    high: ['error', 'success', 'failed', 'completed', 'result', 'summary'],
    medium: ['warning', 'info', 'note', 'found', 'detected'],
    low: ['debug', 'trace', 'verbose']
  };

  const lowerText = text.toLowerCase();
  let score = 0;

  Object.entries(importanceIndicators).forEach(([level, indicators]) => {
    const levelScore = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
    indicators.forEach(indicator => {
      if (lowerText.includes(indicator)) {
        score += levelScore;
      }
    });
  });

  // Normalize to 0-1 range
  return Math.min(score / 10, 1);
}

/**
 * Calculate compression ratio
 * @param {Object} original - Original content
 * @param {Object} summary - Generated summary
 * @param {Array} keySections - Key sections
 * @returns {number} Compression ratio (0-1)
 */
function calculateCompressionRatio(original, summary, keySections) {
  const originalSize = calculateContentSize(original);
  const compressedSize = calculateContentSize({ summary, keySections });

  return originalSize > 0 ? 1 - (compressedSize / originalSize) : 0;
}

/**
 * Generate navigation information
 * @param {Object} content - Original content
 * @param {Object} config - Output configuration
 * @returns {Object} Navigation info
 */
function generateNavigationInfo(content, config) {
  const totalSize = config.estimatedTokens;
  const sections = Array.isArray(content) ? content.length : 1;

  return {
    totalSections: sections,
    estimatedTotalTokens: totalSize,
    hasOverflow: totalSize > config.maxTokens,
    canRetrieveFull: config.enableOverflow,
    retrievalMethod: config.enableOverflow ? 'overflow files' : 'direct access'
  };
}

/**
 * Format progressive output for MCP response
 * @param {Object} progressiveContent - Progressive disclosure content
 * @returns {Array} Formatted MCP content array
 */
export function formatProgressiveOutput(progressiveContent) {
  const content = [];

  // Add summary
  content.push({
    type: 'text',
    text: generateSummaryHeader(progressiveContent)
  });

  // Add key sections
  if (progressiveContent.keySections && progressiveContent.keySections.length > 0) {
    content.push({
      type: 'text',
      text: '\n🔍 Key Sections:\n'
    });

    progressiveContent.keySections.forEach((section, index) => {
      const importanceEmoji = section.importance > 0.7 ? '🔥' :
                             section.importance > 0.4 ? '⚡' : '📄';

      content.push({
        type: 'text',
        text: `${importanceEmoji} Section ${section.index + 1} (${section.type}):\n${section.preview}\n`
      });
    });
  }

  // Add navigation info
  if (progressiveContent.fullContentAvailable) {
    content.push({
      type: 'text',
      text: generateNavigationFooter(progressiveContent)
    });
  }

  // Add full content if available
  if (progressiveContent.originalContent) {
    content.push(progressiveContent.originalContent);
  }

  return content;
}

/**
 * Generate summary header text
 * @param {Object} progressiveContent - Progressive content
 * @returns {string} Summary header
 */
function generateSummaryHeader(progressiveContent) {
  const summary = progressiveContent.summary;
  const navigation = progressiveContent.navigation;

  let header = `📊 Content Summary\n`;
  header += `• Items: ${summary.itemCount}\n`;
  header += `• Lines: ${summary.totalLines}\n`;
  header += `• Reading time: ~${summary.estimatedReadingTime}min\n`;
  header += `• Size: ${progressiveContent.estimatedSize}\n`;

  if (progressiveContent.compressionRatio > 0) {
    header += `• Compressed: ${Math.round(progressiveContent.compressionRatio * 100)}% smaller\n`;
  }

  if (navigation.hasOverflow) {
    header += `• Full content available via ${navigation.retrievalMethod}\n`;
  }

  return header;
}

/**
 * Generate navigation footer
 * @param {Object} progressiveContent - Progressive content
 * @returns {string} Navigation footer
 */
function generateNavigationFooter(progressiveContent) {
  const navigation = progressiveContent.navigation;

  let footer = '\n🗺️ Navigation\n';

  if (navigation.hasOverflow) {
    footer += `• Full content is available (${navigation.estimatedTotalTokens} tokens total)\n`;
    footer += `• Use retrieve_overflow tool to access complete content\n`;
    footer += `• Total sections: ${navigation.totalSections}\n`;
  }

  footer += `• Compression ratio: ${Math.round(progressiveContent.compressionRatio * 100)}%\n`;

  return footer;
}

/**
 * Apply smart output management to tool response
 * @param {Object} response - Original tool response
 * @param {string} taskPrompt - Original task prompt
 * @param {string} workingDirectory - Working directory
 * @returns {Object} Enhanced response with smart output management
 */
export function applySmartOutputManagement(response, taskPrompt, workingDirectory) {
  if (!response || !response.content) {
    return response;
  }

  const config = configureOutput(response.content, taskPrompt, workingDirectory);

  if (!config.progressive) {
    return response; // Return original if no progressive disclosure needed
  }

  const progressiveContent = provideProgressiveOutput(response.content, config);
  const formattedContent = formatProgressiveOutput(progressiveContent);

  return {
    ...response,
    content: formattedContent,
    _metadata: {
      outputConfig: config,
      compressionRatio: progressiveContent.compressionRatio,
      originalSize: config.estimatedTokens,
      compressedSize: calculateContentSize(formattedContent)
    }
  };
}