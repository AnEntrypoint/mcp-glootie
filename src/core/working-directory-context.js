// Enhanced context system for working directory management

export class WorkingDirectoryContext {
  constructor() {
    this.projectCache = new Map();
  }

  async getContext(workingDirectory) {
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

  async loadContext(workingDirectory) {
    return this.getContext(workingDirectory);
  }

  async saveContext(workingDirectory, context) {
    // No-op - don't save context
  }

  getContextPath(workingDirectory) {
    // Return a path that won't be used
    return '/dev/null';
  }

  async updateContext(workingDirectory, toolName, toolData) {
    // No-op - don't update context
    return await this.getContext(workingDirectory);
  }

  async getToolContext(workingDirectory, toolName, query) {
    const context = await this.getContext(workingDirectory);

    return {
      workingDirectory,
      toolName,
      query,
      relevantFiles: [],
      commonPatterns: [],
      previousUsage: null,
      insights: [],
      sessionData: {
        totalToolCalls: 0,
        lastAccessed: Date.now()
      }
    };
  }

  async getContextStats(workingDirectory) {
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

  async clearContext(workingDirectory) {
    // No-op
  }

  cleanupStaleContexts() {
    // No-op
  }
}

export const workingDirectoryContext = new WorkingDirectoryContext();

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

export function withContext(toolHandler, toolName) {
  // Simply wrap the tool handler without adding context functionality
  return async (args) => {
    try {
      return await toolHandler(args);
    } catch (error) {
      throw error;
    }
  };
}

export function getContextSummary(context) {
  // Return empty string since context is disabled
  return '';
}