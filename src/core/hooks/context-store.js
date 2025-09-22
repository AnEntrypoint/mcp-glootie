// Simple hook-based context management
console.log('🧠 CONTEXT HOOK - Setting up lightweight context system...');

// Simple in-memory context store
const contextStore = {
  analyses: new Map(),
  patterns: new Set(),
  searchCache: new Map(),
  lastUpdate: Date.now()
};

// Hook context management functions
export function addContextAnalysis(file, analysis) {
  contextStore.analyses.set(file, {
    ...analysis,
    timestamp: Date.now()
  });

  // Auto-cleanup old entries (keep last 100)
  if (contextStore.analyses.size > 100) {
    const oldest = Array.from(contextStore.analyses.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 20);
    oldest.forEach(([file]) => contextStore.analyses.delete(file));
  }
}

export function getContextAnalysis(file) {
  return contextStore.analyses.get(file);
}

export function addContextPattern(pattern, type = 'general') {
  const patternKey = `${type}:${pattern}`;
  contextStore.patterns.add(patternKey);

  // Keep patterns manageable (last 200)
  if (contextStore.patterns.size > 200) {
    const recentPatterns = Array.from(contextStore.patterns).slice(-180);
    contextStore.patterns.clear();
    recentPatterns.forEach(p => contextStore.patterns.add(p));
  }
}

export function getContextPatterns(type = null) {
  if (type) {
    return Array.from(contextStore.patterns)
      .filter(p => p.startsWith(`${type}:`))
      .map(p => p.substring(type.length + 1));
  }
  return Array.from(contextStore.patterns).map(p => p.replace(/^[^:]+:/, ''));
}

export function cacheSearchResult(query, results, path) {
  const cacheKey = `${path}:${query}`;
  contextStore.searchCache.set(cacheKey, {
    query,
    results,
    path,
    timestamp: Date.now()
  });

  // Clean old cache entries (keep last 50)
  if (contextStore.searchCache.size > 50) {
    const oldest = Array.from(contextStore.searchCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 10);
    oldest.forEach(([key]) => contextStore.searchCache.delete(key));
  }
}

export function getSearchResult(query, path) {
  const cacheKey = `${path}:${query}`;
  const cached = contextStore.searchCache.get(cacheKey);

  // Cache expires after 5 minutes
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.results;
  }
  return null;
}

export function getContextSummary() {
  return {
    totalAnalyses: contextStore.analyses.size,
    totalPatterns: contextStore.patterns.size,
    cachedSearches: contextStore.searchCache.size,
    lastUpdate: contextStore.lastUpdate,
    memoryUsage: {
      analyses: contextStore.analyses.size,
      patterns: contextStore.patterns.size,
      searchCache: contextStore.searchCache.size
    }
  };
}

export function clearContext() {
  contextStore.analyses.clear();
  contextStore.patterns.clear();
  contextStore.searchCache.clear();
  contextStore.lastUpdate = Date.now();
}

// Export for use by other hooks
export default {
  addContextAnalysis,
  getContextAnalysis,
  addContextPattern,
  getContextPatterns,
  cacheSearchResult,
  getSearchResult,
  getContextSummary,
  clearContext
};