
// Performance monitoring and error handling utilities
const performanceMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  averageResponseTime: 0,
  peakResponseTime: 0,
  cacheHits: 0,
  lastOptimization: Date.now()
};

const responseCache = new Map();
const cacheUsage = new Map();
global.CACHE_TTL = 60000; // 60 seconds default

export function withPerformanceTracking(response) {
  performanceMetrics.requestCount++;

  if (performanceMetrics.requestCount % 50 === 0) {
    const cacheHitRate = (performanceMetrics.cacheHits / performanceMetrics.requestCount * 100).toFixed(1);
    const avgResponseTime = performanceMetrics.averageResponseTime.toFixed(1);

    console.error(`[PERFORMANCE] Requests: ${performanceMetrics.requestCount}, Avg: ${avgResponseTime}ms, Peak: ${performanceMetrics.peakResponseTime}ms, Cache Hit Rate: ${cacheHitRate}%`);
  }

  if (performanceMetrics.requestCount % 200 === 0) {
    optimizePerformance();
  }

  return response;
}

export function optimizePerformance() {
  const now = Date.now();
  const timeSinceLastOptimization = now - performanceMetrics.lastOptimization;

  if (timeSinceLastOptimization < 300000) return; 

  const avgResponseTime = performanceMetrics.averageResponseTime;
  const cacheHitRate = performanceMetrics.cacheHits / performanceMetrics.requestCount;

  if (avgResponseTime > 1000 && cacheHitRate < 0.5) {
    
    global.CACHE_TTL = Math.min(CACHE_TTL * 1.5, 300000); 
    console.error(`[OPTIMIZATION] Increased cache TTL to ${global.CACHE_TTL}ms due to poor performance`);
  } else if (avgResponseTime < 200 && cacheHitRate > 0.8) {
    
    global.CACHE_TTL = Math.max(CACHE_TTL * 0.8, 15000); 
    console.error(`[OPTIMIZATION] Reduced cache TTL to ${global.CACHE_TTL}ms due to good performance`);
  }

  if (responseCache.size > 50) {
    const keysToDelete = [];
    for (const [key, entry] of responseCache) {
      if (now - entry.timestamp > CACHE_TTL * 0.5) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      responseCache.delete(key);
      cacheUsage.delete(key);
    });

    console.error(`[OPTIMIZATION] Cleared ${keysToDelete.length} old cache entries`);
  }

  performanceMetrics.lastOptimization = now;
}

export function parseError(error) {
  const errorCodeMap = {
    'ENOENT': { code: -32001, message: 'File or directory not found', shouldFallback: true },
    'EACCES': { code: -32002, message: 'Permission denied', shouldFallback: false },
    'ETIMEOUT': { code: -32003, message: 'Operation timeout', shouldFallback: true },
    'EMFILE': { code: -32004, message: 'Too many open files', shouldFallback: true },
    'ENOMEM': { code: -32005, message: 'Out of memory', shouldFallback: false },
    'EPERM': { code: -32006, message: 'Operation not permitted', shouldFallback: false }
  };

  const errorKey = Object.keys(errorCodeMap).find(key => error.message.includes(key) || error.code === key);
  const baseError = errorCodeMap[errorKey] || {
    code: -32000,
    message: error.message || 'Unknown error',
    shouldFallback: false
  };

  return {
    ...baseError,
    suggestions: getErrorSuggestions(baseError.code, error),
    originalError: error
  };
}

export function getErrorSuggestions(errorCode, error) {
  const suggestions = {
    '-32001': ['Check if the file path exists', 'Verify directory permissions', 'Use absolute paths'],
    '-32002': ['Run with elevated permissions', 'Check file ownership', 'Verify process capabilities'],
    '-32003': ['Increase timeout value', 'Check network connectivity', 'Reduce operation complexity'],
    '-32004': ['Close unused file handles', 'Increase file descriptor limit', 'Process files in batches'],
    '-32005': ['Reduce memory usage', 'Process data in chunks', 'Free unused resources'],
    '-32006': ['Check system permissions', 'Verify user capabilities', 'Run with appropriate privileges']
  };

  return suggestions[errorCode] || ['Retry the operation', 'Check system resources', 'Verify input parameters'];
}

export async function attemptFallback(toolName, args, errorInfo) {
  const fallbackStrategies = {
    'searchcode': async (args) => {
      
      const fs = await import('fs');
      const path = await import('path');
      const results = [];

      const searchDir = args.workingDirectory || process.cwd();
      const searchTerm = args.query || 'function';

      try {
        const files = fs.readdirSync(searchDir);
        for (const file of files) {
          if (file.endsWith('.js') || file.endsWith('.ts')) {
            const content = fs.readFileSync(path.join(searchDir, file), 'utf8');
            if (content.includes(searchTerm)) {
              results.push({ file, matches: content.split('\n').filter(line => line.includes(searchTerm)).length });
            }
          }
        }
        return { results, _fallbackMethod: 'filesystem_search' };
      } catch (e) {
        return null;
      }
    },

    'execute': async (args) => {
      
      try {
        if (args.commands) {
          const { execSync } = await import('child_process');
          const result = execSync(args.commands, {
            encoding: 'utf8',
            timeout: 30000,
            cwd: args.workingDirectory
          });
          return { output: result, _fallbackMethod: 'simplified_execution' };
        }
      } catch (e) {
        return null;
      }
    }
  };

  const fallback = fallbackStrategies[toolName];
  return fallback ? fallback(args) : null;
}

