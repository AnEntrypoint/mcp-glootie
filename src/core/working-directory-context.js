import fs from 'fs/promises';
import path from 'path';
class WorkingDirectoryContext {
  constructor() {
    this.contexts = new Map(); 
    this.contextDir = '.claude-context';
    this.contextFile = 'tool-context.json';
    this.maxContextAge = 30 * 60 * 1000; 
    this.maxContextSize = 100 * 1024; 
  }
  
  async getContext(workingDirectory) {
    const normalizedDir = path.resolve(workingDirectory);
    if (this.contexts.has(normalizedDir)) {
      const context = this.contexts.get(normalizedDir);
      
      if (Date.now() - context.lastAccessed < this.maxContextAge) {
        context.lastAccessed = Date.now();
        return context;
      }
    }
    
    const context = await this.loadContext(normalizedDir);
    this.contexts.set(normalizedDir, context);
    return context;
  }
  
  async loadContext(workingDirectory) {
    const contextPath = this.getContextPath(workingDirectory);
    try {
      const data = await fs.readFile(contextPath, 'utf8');
      const parsed = JSON.parse(data);
      
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
  
  async saveContext(workingDirectory, context) {
    try {
      const contextPath = this.getContextPath(workingDirectory);
      const contextDir = path.dirname(contextPath);
      
      await fs.mkdir(contextDir, { recursive: true });
      
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
  
  getContextPath(workingDirectory) {
    return path.join(workingDirectory, this.contextDir, this.contextFile);
  }
  
  async updateContext(workingDirectory, toolName, toolData) {
    const context = await this.getContext(workingDirectory);
    
    context.metadata.totalToolCalls++;
    context.metadata.lastModified = Date.now();
    
    if (!context.data.toolUsage) {
      context.data.toolUsage = {};
    }
    if (!context.data.toolUsage[toolName]) {
      context.data.toolUsage[toolName] = { count: 0, lastUsed: 0, files: [] };
    }
    context.data.toolUsage[toolName].count++;
    context.data.toolUsage[toolName].lastUsed = Date.now();
    
    if (toolData) {
      if (toolData.filesAccessed) {
        context.data.toolUsage[toolName].files.push(...toolData.filesAccessed);
        
        this.updatePreferredFiles(context, toolData.filesAccessed);
      }
      if (toolData.patterns) {
        this.updatePatterns(context, toolData.patterns);
      }
      if (toolData.insights && Array.isArray(toolData.insights) && toolData.insights.length > 0) {
        if (!context.data.insights) {
          context.data.insights = [];
        }
        context.data.insights.push(...toolData.insights);
      }
    }
    
    if (JSON.stringify(context).length > this.maxContextSize) {
      this.cleanupContextData(context);
    }
    
    await this.saveContext(workingDirectory, context);
    return context;
  }
  
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
  
  getRelevantFiles(context, query) {
    const allFiles = new Set();
    
    Object.values(context.data.toolUsage || {}).forEach(tool => {
      tool.files.forEach(file => allFiles.add(file));
    });
    
    context.metadata.preferredFiles.forEach(file => allFiles.add(file.path));
    
    const filesArray = Array.from(allFiles);
    return this.prioritizeFiles(filesArray, query);
  }
  
  prioritizeFiles(files, query) {
    if (!query || typeof query !== 'string') return files;
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
  
  extractKeywords(query) {
    if (!query || typeof query !== 'string') return [];
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return query
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
  }
  
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
    
    context.metadata.preferredFiles.sort((a, b) => b.count - a.count);
    context.metadata.preferredFiles = context.metadata.preferredFiles.slice(0, 20);
  }
  
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
    
    context.metadata.commonPatterns.sort((a, b) => b.count - a.count);
    context.metadata.commonPatterns = context.metadata.commonPatterns.slice(0, 10);
  }
  
  cleanupOldData(parsed) {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; 
    
    if (parsed.data && parsed.data.toolUsage) {
      Object.entries(parsed.data.toolUsage).forEach(([toolName, toolData]) => {
        if (now - toolData.lastUsed > maxAge) {
          delete parsed.data.toolUsage[toolName];
        }
      });
    }
    
    if (parsed.data && parsed.data.insights) {
      
      
    }
  }
  
  cleanupContextData(context) {
    
    if (context.data.toolUsage) {
      Object.entries(context.data.toolUsage).forEach(([toolName, toolData]) => {
        
        toolData.files = toolData.files.slice(-50);
      });
    }
    
    if (context.data.insights) {
      context.data.insights = context.data.insights.slice(-100);
    }
    
    context.metadata.preferredFiles = context.metadata.preferredFiles.slice(0, 10);
  }
  
  async getContextStats(workingDirectory) {
    try {
      const context = await this.getContext(workingDirectory);
      const contextPath = this.getContextPath(workingDirectory);
      let fileSize = 0;
      try {
        const stats = await fs.stat(contextPath);
        fileSize = stats.size;
      } catch (error) {
        
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
  
  async clearContext(workingDirectory) {
    const normalizedDir = path.resolve(workingDirectory);
    this.contexts.delete(normalizedDir);
    try {
      const contextPath = this.getContextPath(workingDirectory);
      await fs.unlink(contextPath);
    } catch (error) {
      
    }
  }
  
  cleanupStaleContexts() {
    const now = Date.now();
    for (const [workingDirectory, context] of this.contexts) {
      if (now - context.lastAccessed > this.maxContextAge) {
        this.contexts.delete(workingDirectory);
      }
    }
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
  return async (args) => {
    const workingDirectory = args.workingDirectory || process.cwd();
    const query = args.query || args.pattern || args.code || '';
    try {
      
      const context = await workingDirectoryContext.getToolContext(workingDirectory, toolName, query);
      
      const result = await toolHandler(args);
      
      const toolContext = createToolContext(toolName, workingDirectory, query, result);
      
      await workingDirectoryContext.updateContext(workingDirectory, toolName, toolContext);
      
      if (result && result.content && result.content[0] && result.content[0].type === 'text') {
        const contextInfo = getContextSummary(context);
        result.content[0].text = contextInfo + result.content[0].text;
      }
      return result;
    } catch (error) {
      
      const errorContext = createToolContext(toolName, workingDirectory, query, {
        error: error.message,
        duration: 0
      });
      await workingDirectoryContext.updateContext(workingDirectory, toolName, errorContext);
      throw error;
    }
  };
}
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
  lines.push(''); 
  return lines.join('\n') + '\n';
}
export { getContextSummary };