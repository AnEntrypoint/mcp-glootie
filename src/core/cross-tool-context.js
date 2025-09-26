// Enhanced cross-tool communication with time caps and smart caching
import { v4 as uuidv4 } from 'uuid';

// Smart cache with TTL and memory management
class SmartCache {
  constructor(maxSize = 1000, defaultTTL = 300000) { // 5 minutes default
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.accessTimes = new Map();
  }

  set(key, value, ttl = this.defaultTTL) {
    // Clean up if cache is full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    const expires = Date.now() + ttl;
    this.cache.set(key, { value, expires });
    this.accessTimes.set(key, Date.now());
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      return null;
    }

    this.accessTimes.set(key, Date.now());
    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
    this.accessTimes.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessTimes.clear();
  }

  cleanup() {
    const now = Date.now();
    const toDelete = [];

    // Remove expired entries
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        toDelete.push(key);
      }
    }

    // Remove least recently used if still over size
    if (this.cache.size - toDelete.length >= this.maxSize) {
      const sorted = Array.from(this.accessTimes.entries())
        .sort(([, a], [, b]) => a - b);

      const toRemove = sorted.slice(0, this.cache.size - this.maxSize + toDelete.length);
      toDelete.push(...toRemove.map(([key]) => key));
    }

    toDelete.forEach(key => this.delete(key));
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hitRate || 0
    };
  }
}

// Delta-based context manager
class DeltaContextManager {
  constructor() {
    this.baseContext = new Map();
    this.deltas = new Map();
    this.lastSync = Date.now();
  }

  updateBaseContext(key, value) {
    const oldValue = this.baseContext.get(key);
    this.baseContext.set(key, value);

    // Store delta
    this.deltas.set(`${key}_${Date.now()}`, {
      key,
      oldValue,
      newValue: value,
      timestamp: Date.now()
    });

    // Clean old deltas (keep only last 100)
    if (this.deltas.size > 100) {
      const sorted = Array.from(this.deltas.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toDelete = sorted.slice(0, this.deltas.size - 100);
      toDelete.forEach(([key]) => this.deltas.delete(key));
    }
  }

  getDeltas(since) {
    const relevantDeltas = [];
    for (const [id, delta] of this.deltas) {
      if (delta.timestamp > since) {
        relevantDeltas.push(delta);
      }
    }
    return relevantDeltas;
  }

  getContext(since = null) {
    if (!since) {
      return Object.fromEntries(this.baseContext);
    }

    const deltas = this.getDeltas(since);
    const context = {};

    // Apply deltas in order
    deltas.forEach(delta => {
      context[delta.key] = delta.newValue;
    });

    return context;
  }

  compress() {
    // Clean old deltas (older than 5 minutes)
    const cutoff = Date.now() - 300000;
    for (const [id, delta] of this.deltas) {
      if (delta.timestamp < cutoff) {
        this.deltas.delete(id);
      }
    }
  }
}

export class CrossToolContext {
  constructor() {
    this.toolSessions = new Map();
    this.currentSession = null;
    this.globalContext = new DeltaContextManager();
    this.smartCache = new SmartCache(1000, 300000); // 5 minute TTL
    this.resultCache = new SmartCache(500, 180000); // 3 minute TTL for results
    this.duplicationSuppression = new Map();
    this.reportedItems = new Map(); // Track reported items for suppression
    this.lastCleanup = Date.now();
  }

  // Time cap constants
  static TIME_CAPS = {
    ANALYSIS: 60000,      // 1 minute for analysis
    LINT: 30000,          // 30 seconds for linting
    EXECUTION: 120000,    // 2 minutes for execution
    SEARCH: 45000,        // 45 seconds for search
    DEFAULT: 30000       // 30 seconds default
  };

  // Get time cap for tool type
  getTimeCap(toolName) {
    const name = toolName.toLowerCase();
    if (name.includes('ast') || name.includes('analysis')) return this.constructor.TIME_CAPS.ANALYSIS;
    if (name.includes('lint')) return this.constructor.TIME_CAPS.LINT;
    if (name.includes('exec')) return this.constructor.TIME_CAPS.EXECUTION;
    if (name.includes('search')) return this.constructor.TIME_CAPS.SEARCH;
    return this.constructor.TIME_CAPS.DEFAULT;
  }

  // Check for duplicate operations
  isDuplicate(toolName, workingDirectory, query, args) {
    const signature = this.createOperationSignature(toolName, workingDirectory, query, args);
    const lastOperation = this.duplicationSuppression.get(signature);

    if (lastOperation && Date.now() - lastOperation < this.getTimeCap(toolName)) {
      return true;
    }

    this.duplicationSuppression.set(signature, Date.now());

    // Clean old suppression entries
    this.cleanupSuppression();
    return false;
  }

  createOperationSignature(toolName, workingDirectory, query, args) {
    const keyData = {
      toolName,
      workingDirectory,
      query: query ? query.substring(0, 100) : '',
      argsHash: this.hashArgs(args)
    };
    return JSON.stringify(keyData);
  }

  hashArgs(args) {
    // Simple hash of relevant args
    const relevant = {};
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string') {
        relevant[key] = value.substring(0, 50);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        relevant[key] = value;
      }
    }
    return JSON.stringify(relevant);
  }

  cleanupSuppression() {
    const now = Date.now();
    if (now - this.lastCleanup > 60000) { // Clean every minute
      const toDelete = [];

      for (const [signature, timestamp] of this.duplicationSuppression) {
        if (now - timestamp > 300000) { // 5 minutes
          toDelete.push(signature);
        }
      }

      toDelete.forEach(signature => this.duplicationSuppression.delete(signature));

      // Clean old reported items (older than 10 minutes)
      const reportedToDelete = [];
      for (const [signature, timestamp] of this.reportedItems) {
        if (now - timestamp > 600000) { // 10 minutes
          reportedToDelete.push(signature);
        }
      }
      reportedToDelete.forEach(signature => this.reportedItems.delete(signature));

      this.lastCleanup = now;
    }
  }

  // Check if an item has been reported and should be suppressed
  isReported(category, identifier) {
    const signature = `${category}:${identifier}`;
    const lastReported = this.reportedItems.get(signature);

    if (lastReported && Date.now() - lastReported < 600000) { // 10 minutes
      return true;
    }

    this.reportedItems.set(signature, Date.now());
    return false;
  }

  // Generate concise report for cross-tool responses
  generateConciseReport(toolName, workingDirectory, result) {
    const report = {
      tool: toolName,
      location: workingDirectory,
      timestamp: Date.now(),
      summary: this.createSummary(result)
    };

    // Only include essential information
    if (result.filesAccessed && result.filesAccessed.length > 0) {
      report.files = result.filesAccessed.slice(0, 3); // Max 3 files
    }

    if (result.patterns && result.patterns.length > 0) {
      report.patterns = result.patterns.slice(0, 2); // Max 2 patterns
    }

    return report;
  }

  // Create a concise summary from result data
  createSummary(result) {
    if (result.error) {
      return `Error: ${result.error.message || result.error}`;
    }

    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find(c => c.type === 'text')?.text || '';
      if (textContent.startsWith('[')) { // JSON array
        try {
          const parsed = JSON.parse(textContent);
          if (Array.isArray(parsed)) {
            return `${parsed.length} items found`;
          }
        } catch {
          // Fall through to text summary
        }
      }
      return textContent.substring(0, 100) + (textContent.length > 100 ? '...' : '');
    }

    if (result.stdout) {
      return result.stdout.split('\n')[0].substring(0, 100) + (result.stdout.length > 100 ? '...' : '');
    }

    return 'Operation completed';
  }

  // Suppress duplicate reporting with enhanced checks
  shouldReport(toolName, workingDirectory, result) {
    // Create signature for this report
    const signature = this.createReportSignature(toolName, workingDirectory, result);

    // Check if we've reported something very similar recently
    return !this.isReported('tool_report', signature);
  }

  createReportSignature(toolName, workingDirectory, result) {
    const keyParts = [
      toolName,
      workingDirectory,
      result.error ? 'error' : 'success',
      result.content ? 'content' : 'no-content',
      result.filesAccessed?.length || 0,
      result.patterns?.length || 0
    ];
    return keyParts.join('|');
  }

  // Smart caching for intermediate results
  cacheResult(toolName, workingDirectory, key, result, ttl = null) {
    const cacheKey = `${toolName}_${workingDirectory}_${key}`;
    const resultTTL = ttl || this.getTimeCap(toolName);
    this.resultCache.set(cacheKey, result, resultTTL);
  }

  getCachedResult(toolName, workingDirectory, key) {
    const cacheKey = `${toolName}_${workingDirectory}_${key}`;
    return this.resultCache.get(cacheKey);
  }

  // Cache computation results
  cacheComputation(toolName, key, computation, ttl = null) {
    if (this.smartCache.has(key)) {
      return this.smartCache.get(key);
    }

    const result = computation();
    const cacheTTL = ttl || this.getTimeCap(toolName);
    this.smartCache.set(key, result, cacheTTL);

    return result;
  }

  // Start a new tool session with time cap
  startToolSession({
    id = uuidv4(),
    toolName,
    workingDirectory,
    query,
    startTime = Date.now(),
    args = {}
  } = {}) {
    // Check for duplicates
    if (this.isDuplicate(toolName, workingDirectory, query, args)) {
      throw new Error(`Duplicate operation suppressed: ${toolName}`);
    }

    const session = {
      id,
      toolName,
      workingDirectory,
      query,
      startTime,
      timeCap: this.getTimeCap(toolName),
      status: 'running',
      result: null,
      error: null,
      relatedSessions: [],
      metadata: {}
    };

    this.toolSessions.set(id, session);
    this.currentSession = id;

    return session;
  }

  // Complete current tool session
  completeCurrentSession(result) {
    if (!this.currentSession) return null;

    const session = this.toolSessions.get(this.currentSession);
    if (session) {
      session.status = 'completed';
      session.endTime = Date.now();
      session.duration = session.endTime - session.startTime;
      session.result = result;

      // Cache result if under time cap
      if (session.duration < session.timeCap) {
        this.cacheResult(
          session.toolName,
          session.workingDirectory,
          session.query || 'default',
          result,
          session.timeCap
        );
      }

      // Update global context with delta
      this.updateGlobalContext(session);

      return session;
    }
    return null;
  }

  // Get current tool session with time cap check
  getCurrentSession() {
    if (!this.currentSession) return null;

    const session = this.toolSessions.get(this.currentSession);

    // Clear current if it's too old (exceeded time cap)
    if (session && Date.now() - session.startTime > session.timeCap) {
      this.currentSession = null;
      return null;
    }

    return session;
  }

  // Update global context using delta-based updates
  updateGlobalContext(session) {
    const key = `${session.toolName}_${session.workingDirectory}`;
    const currentContext = this.globalContext.getContext();

    let context = currentContext[key] || {
      toolName: session.toolName,
      workingDirectory: session.workingDirectory,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
      lastUsed: 0,
      commonPatterns: new Set(),
      recentFiles: new Set()
    };

    // Create delta
    context.totalCalls++;
    context.lastUsed = Date.now();

    if (session.status === 'completed') {
      context.successfulCalls++;
    } else if (session.status === 'failed') {
      context.failedCalls++;
    }

    // Update average duration
    if (session.duration) {
      context.averageDuration = (context.averageDuration * (context.totalCalls - 1) + session.duration) / context.totalCalls;
    }

    // Store session-specific metadata
    if (session.metadata) {
      if (session.metadata.patterns) {
        session.metadata.patterns.forEach(pattern => context.commonPatterns.add(pattern));
      }
      if (session.metadata.filesAccessed) {
        session.metadata.filesAccessed.forEach(file => context.recentFiles.add(file));
      }
    }

    this.globalContext.updateBaseContext(key, context);
  }

  // Clean up old sessions and compress context
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    // Delete old sessions
    for (const [id, session] of this.toolSessions) {
      const age = now - session.startTime;
      if (age > 300000) { // 5 minutes
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => {
      this.toolSessions.delete(id);
      if (this.currentSession === id) {
        this.currentSession = null;
      }
    });

    // Compress context
    this.globalContext.compress();

    // Clean caches
    this.smartCache.cleanup();
    this.resultCache.cleanup();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      smartCache: this.smartCache.getStats(),
      resultCache: this.resultCache.getStats(),
      sessions: this.toolSessions.size,
      duplicatesSuppressed: this.duplicationSuppression.size
    };
  }
}

// Global instance
export const crossToolContext = new CrossToolContext();

// Enhanced middleware function with smart caching and duplication suppression
export function withCrossToolAwareness(toolHandler, toolName) {
  return async (args) => {
    const workingDirectory = args.workingDirectory || process.cwd();
    const query = args.query || args.pattern || args.code || '';

    // Start tool session with time cap and duplication check
    const session = crossToolContext.startToolSession({
      toolName,
      workingDirectory,
      query,
      args
    });

    try {
      // Check cache first
      const cacheKey = JSON.stringify(args);
      const cachedResult = crossToolContext.getCachedResult(toolName, workingDirectory, cacheKey);

      if (cachedResult) {
        // Return cached result with metadata
        return {
          ...cachedResult,
          _cached: true,
          _cacheTimestamp: Date.now()
        };
      }

      // Execute the tool with smart caching for expensive operations
      const result = await crossToolContext.cacheComputation(
        toolName,
        cacheKey,
        () => toolHandler(args)
      );

      // Complete session and cache result
      crossToolContext.completeCurrentSession(result);

      // Add session metadata
      if (session) {
        session.metadata = {
          filesAccessed: result._filesAccessed || [],
          patterns: result._patterns || [],
          insights: result._insights || []
        };
      }

      return result;

    } catch (error) {
      // Fail session and return error
      crossToolContext.failCurrentSession(error);
      throw error;
    }
  };
}

// Utility function to add tool-specific metadata with concise reporting
export function addToolMetadata(result, metadata) {
  const enhancedResult = {
    ...result,
    ...metadata
  };

  // Add concise report if this should be reported
  if (metadata.toolName && metadata.workingDirectory) {
    if (crossToolContext.shouldReport(metadata.toolName, metadata.workingDirectory, result)) {
      const conciseReport = crossToolContext.generateConciseReport(
        metadata.toolName,
        metadata.workingDirectory,
        result
      );
      enhancedResult._conciseReport = conciseReport;
    }
  }

  return enhancedResult;
}

// Utility function to generate location-based concise report
export function generateLocationReport(toolName, workingDirectory, files = [], summary = '') {
  const report = {
    tool: toolName,
    location: workingDirectory,
    timestamp: Date.now(),
    files: files.slice(0, 5), // Max 5 files
    summary: summary || `${files.length} files processed`
  };

  // Only report if not recently reported
  const signature = `${toolName}:${workingDirectory}:${files.length}:${summary.substring(0, 50)}`;
  if (!crossToolContext.isReported('location_report', signature)) {
    return report;
  }

  return null; // Suppressed
}