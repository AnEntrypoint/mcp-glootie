import fs from 'fs/promises';
import path from 'path';

// Console output is now suppressed globally in index.js when MCP_MODE is set

/**
 * Working Directory Context Manager
 * Provides stateless, working directory-based context for MCP tools
 */
class WorkingDirectoryContext {
  constructor() {
    this.contexts = new Map(); // workingDirectory -> ContextData
    this.contextDir = '.claude-context';
    this.contextFile = 'tool-context.json';
    this.maxContextAge = 30 * 60 * 1000; // 30 minutes
    this.maxContextSize = 100 * 1024; // 100KB
  }

  /**
   * Get or create context for working directory
   */
  async getContext(workingDirectory) {
    const normalizedDir = path.resolve(workingDirectory);

    if (this.contexts.has(normalizedDir)) {
      const context = this.contexts.get(normalizedDir);
      // Check if context is stale
      if (Date.now() - context.lastAccessed < this.maxContextAge) {
        context.lastAccessed = Date.now();
        return context;
      }
    }

    // Load or create fresh context
    const context = await this.loadContext(normalizedDir);
    this.contexts.set(normalizedDir, context);
    return context;
  }

  /**
   * Load context from persistent storage
   */
  async loadContext(workingDirectory) {
    const contextPath = this.getContextPath(workingDirectory);

    try {
      const data = await fs.readFile(contextPath, 'utf8');
      const parsed = JSON.parse(data);

      // Clean up old entries
      this.cleanupOldData(parsed);

      return {
        workingDirectory,
        data: parsed.data || {},
        metadata: parsed.metadata || {
          totalToolCalls: 0,
          commonPatterns: [],
          preferredFiles: [],
          lastModified: Date.now()
        },
        lastAccessed: Date.now(),
        persistent: true
      };
    } catch (error) {
      // Return fresh context if file doesn't exist
      return {
        workingDirectory,
        data: {},
        metadata: {
          totalToolCalls: 0,
          commonPatterns: [],
          preferredFiles: [],
          lastModified: Date.now()
        },
        lastAccessed: Date.now(),
        persistent: false
      };
    }
  }

  /**
   * Save context to persistent storage
   */
  async saveContext(workingDirectory, context) {
    try {
      const contextPath = this.getContextPath(workingDirectory);
      const contextDir = path.dirname(contextPath);

      // Ensure directory exists
      await fs.mkdir(contextDir, { recursive: true });

      // Prepare data for storage
      const storageData = {
        version: '1.0',
        workingDirectory,
        data: context.data,
        metadata: {
          ...context.metadata,
          lastModified: Date.now()
        }
      };

      await fs.writeFile(contextPath, JSON.stringify(storageData, null, 2));
      context.persistent = true;
    } catch (error) {
      console.warn(`Failed to save context for ${workingDirectory}:`, error);
    }
  }

  /**
   * Get context file path
   */
  getContextPath(workingDirectory) {
    return path.join(workingDirectory, this.contextDir, this.contextFile);
  }

  /**
   * Update context with tool usage data
   */
  async updateContext(workingDirectory, toolName, toolData) {
    const context = await this.getContext(workingDirectory);

    // Update metadata
    context.metadata.totalToolCalls++;
    context.metadata.lastModified = Date.now();

    // Track tool usage
    if (!context.data.toolUsage) {
      context.data.toolUsage = {};
    }
    if (!context.data.toolUsage[toolName]) {
      context.data.toolUsage[toolName] = { count: 0, lastUsed: 0, files: [] };
    }
    context.data.toolUsage[toolName].count++;
    context.data.toolUsage[toolName].lastUsed = Date.now();

    // Add specific tool data
    if (toolData) {
      if (toolData.filesAccessed) {
        context.data.toolUsage[toolName].files.push(...toolData.filesAccessed);
        // Update preferred files based on frequency
        this.updatePreferredFiles(context, toolData.filesAccessed);
      }

      if (toolData.patterns) {
        this.updatePatterns(context, toolData.patterns);
      }

      if (toolData.insights) {
        if (!context.data.insights) {
          context.data.insights = [];
        }
        context.data.insights.push(...toolData.insights);
      }
    }

    // Clean up if getting too large
    if (JSON.stringify(context).length > this.maxContextSize) {
      this.cleanupContextData(context);
    }

    // Save to persistent storage
    await this.saveContext(workingDirectory, context);

    return context;
  }

  /**
   * Get relevant context for a tool call
   */
  async getToolContext(workingDirectory, toolName, query) {
    const context = await this.getContext(workingDirectory);

    const toolContext = {
      workingDirectory,
      toolName,
      query,
      relevantFiles: this.getRelevantFiles(context, query),
      commonPatterns: context.metadata.commonPatterns,
      previousUsage: context.data.toolUsage?.[toolName] || null,
      insights: context.data.insights || [],
      sessionData: {
        totalToolCalls: context.metadata.totalToolCalls,
        lastAccessed: context.lastAccessed
      }
    };

    return toolContext;
  }

  /**
   * Get relevant files based on query and context
   */
  getRelevantFiles(context, query) {
    const allFiles = new Set();

    // Collect all files from tool usage
    Object.values(context.data.toolUsage || {}).forEach(tool => {
      tool.files.forEach(file => allFiles.add(file));
    });

    // Add preferred files (extract path from objects)
    context.metadata.preferredFiles.forEach(file => allFiles.add(file.path));

    // Convert to array and prioritize based on query
    const filesArray = Array.from(allFiles);
    return this.prioritizeFiles(filesArray, query);
  }

  /**
   * Prioritize files based on query keywords
   */
  prioritizeFiles(files, query) {
    if (!query) return files;

    const keywords = this.extractKeywords(query.toLowerCase());
    return files.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      keywords.forEach(keyword => {
        if (a.toLowerCase().includes(keyword)) scoreA++;
        if (b.toLowerCase().includes(keyword)) scoreB++;
      });

      return scoreB - scoreA;
    });
  }

  /**
   * Extract keywords from query
   */
  extractKeywords(query) {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return query
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }

  /**
   * Update preferred files based on usage
   */
  updatePreferredFiles(context, files) {
    files.forEach(file => {
      const existing = context.metadata.preferredFiles.find(f => f.path === file);
      if (existing) {
        existing.count++;
        existing.lastUsed = Date.now();
      } else {
        context.metadata.preferredFiles.push({
          path: file,
          count: 1,
          lastUsed: Date.now()
        });
      }
    });

    // Keep only top preferred files
    context.metadata.preferredFiles.sort((a, b) => b.count - a.count);
    context.metadata.preferredFiles = context.metadata.preferredFiles.slice(0, 20);
  }

  /**
   * Update common patterns
   */
  updatePatterns(context, patterns) {
    patterns.forEach(pattern => {
      const existing = context.metadata.commonPatterns.find(p => p.pattern === pattern);
      if (existing) {
        existing.count++;
        existing.lastUsed = Date.now();
      } else {
        context.metadata.commonPatterns.push({
          pattern,
          count: 1,
          lastUsed: Date.now()
        });
      }
    });

    // Keep only top patterns
    context.metadata.commonPatterns.sort((a, b) => b.count - a.count);
    context.metadata.commonPatterns = context.metadata.commonPatterns.slice(0, 10);
  }

  /**
   * Clean up old data
   */
  cleanupOldData(parsed) {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Clean up old tool usage data
    if (parsed.data && parsed.data.toolUsage) {
      Object.entries(parsed.data.toolUsage).forEach(([toolName, toolData]) => {
        if (now - toolData.lastUsed > maxAge) {
          delete parsed.data.toolUsage[toolName];
        }
      });
    }

    // Clean up old insights
    if (parsed.data && parsed.data.insights) {
      parsed.data.insights = parsed.data.insights.filter(insight =>
        now - insight.timestamp < maxAge
      );
    }
  }

  /**
   * Clean up context data when it gets too large
   */
  cleanupContextData(context) {
    // Keep only recent tool usage
    if (context.data.toolUsage) {
      Object.entries(context.data.toolUsage).forEach(([toolName, toolData]) => {
        // Keep only last 50 files per tool
        toolData.files = toolData.files.slice(-50);
      });
    }

    // Keep only recent insights
    if (context.data.insights) {
      context.data.insights = context.data.insights.slice(-100);
    }

    // Keep only top preferred files
    context.metadata.preferredFiles = context.metadata.preferredFiles.slice(0, 10);
  }

  /**
   * Get context statistics
   */
  async getContextStats(workingDirectory) {
    try {
      const context = await this.getContext(workingDirectory);
      const contextPath = this.getContextPath(workingDirectory);

      let fileSize = 0;
      try {
        const stats = await fs.stat(contextPath);
        fileSize = stats.size;
      } catch (error) {
        // File doesn't exist
      }

      return {
        workingDirectory,
        persistent: context.persistent,
        fileSize,
        totalToolCalls: context.metadata.totalToolCalls,
        toolsUsed: Object.keys(context.data.toolUsage || {}).length,
        totalFiles: context.metadata.preferredFiles.length,
        patterns: context.metadata.commonPatterns.length,
        insights: context.data.insights?.length || 0,
        lastModified: context.metadata.lastModified
      };
    } catch (error) {
      return {
        workingDirectory,
        persistent: false,
        fileSize: 0,
        totalToolCalls: 0,
        toolsUsed: 0,
        totalFiles: 0,
        patterns: 0,
        insights: 0,
        lastModified: null
      };
    }
  }

  /**
   * Clear context for working directory
   */
  async clearContext(workingDirectory) {
    const normalizedDir = path.resolve(workingDirectory);
    this.contexts.delete(normalizedDir);

    try {
      const contextPath = this.getContextPath(workingDirectory);
      await fs.unlink(contextPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Clean up stale contexts from memory
   */
  cleanupStaleContexts() {
    const now = Date.now();
    for (const [workingDirectory, context] of this.contexts) {
      if (now - context.lastAccessed > this.maxContextAge) {
        this.contexts.delete(workingDirectory);
      }
    }
  }
}

// Global instance
export const workingDirectoryContext = new WorkingDirectoryContext();

/**
 * Tool context helper functions
 */
export function createToolContext(toolName, workingDirectory, query, result) {
  return {
    toolName,
    workingDirectory,
    query,
    timestamp: Date.now(),
    success: !result.error,
    duration: result.duration || 0,
    filesAccessed: result.filesAccessed || [],
    patterns: result.patterns || [],
    insights: result.insights || []
  };
}

/**
 * Middleware to add context awareness to tools
 */
export function withContext(toolHandler, toolName) {
  return async (args) => {
    const workingDirectory = args.workingDirectory || process.cwd();
    const query = args.query || args.pattern || args.code || '';

    try {
      // Get relevant context for this tool call
      const context = await workingDirectoryContext.getToolContext(workingDirectory, toolName, query);

      // Execute original tool handler
      const result = await toolHandler(args);

      // Extract context data from result
      const toolContext = createToolContext(toolName, workingDirectory, query, result);

      // Update context with tool usage data
      await workingDirectoryContext.updateContext(workingDirectory, toolName, toolContext);

      // Add context information to result if it's in MCP format
      if (result && result.content && result.content[0] && result.content[0].type === 'text') {
        const contextInfo = getContextSummary(context);
        result.content[0].text = contextInfo + result.content[0].text;
      }

      return result;
    } catch (error) {
      // Still update context even for errors
      const errorContext = createToolContext(toolName, workingDirectory, query, {
        error: error.message,
        duration: 0
      });
      await workingDirectoryContext.updateContext(workingDirectory, toolName, errorContext);

      throw error;
    }
  };
}

/**
 * Generate context summary for tool output
 */
function getContextSummary(context) {
  if (!context || !context.sessionData) {
    return '';
  }

  const lines = [];
  lines.push(`📁 Context: ${context.workingDirectory}`);
  lines.push(`🔧 Tool: ${context.toolName}`);
  lines.push(`📊 Session: ${context.sessionData.totalToolCalls} tool calls`);

  if (context.previousUsage) {
    lines.push(`📈 Used ${context.previousUsage.count} times before`);
  }

  if (context.relevantFiles.length > 0) {
    lines.push(`📄 ${context.relevantFiles.length} relevant files available`);
  }

  if (context.insights.length > 0) {
    lines.push(`💡 ${context.insights.length} insights from previous tasks`);
  }

  lines.push(''); // Add separator

  return lines.join('\n') + '\n';
}