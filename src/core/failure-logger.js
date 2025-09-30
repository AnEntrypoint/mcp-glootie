import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

export class FailureLogger {
  constructor(baseDir = null) {
    // Use a writable temporary directory as the base for logging
    const baseDirectory = baseDir || join(process.cwd(), '.glootie');
    this.logFile = join(baseDirectory, 'mcp-failures.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = join(this.logFile, '..');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  logFailure(toolName, error, context = {}) {
    const timestamp = new Date().toISOString();
    const failureEntry = {
      timestamp,
      toolName,
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'UNKNOWN_ERROR',
        stack: error.stack || 'No stack trace available',
        type: error.constructor.name || 'Error'
      },
      context: {
        workingDirectory: context.workingDirectory || process.cwd(),
        query: context.query || '',
        operation: context.operation || '',
        args: JSON.stringify(context.args || {}),
        duration: context.duration || 0
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      }
    };

    // Append to log file
    const logEntry = JSON.stringify(failureEntry) + '\n';
    try {
      writeFileSync(this.logFile, logEntry, { flag: 'a' });
    } catch (logError) {
      console.error('Failed to write to failure log:', logError.message);
    }

    // Also log to console for immediate visibility
    console.error(`🚨 MCP TOOL FAILURE [${toolName}]: ${error.message}`);

    return failureEntry;
  }

  getRecentFailures(limit = 10) {
    try {
      if (!existsSync(this.logFile)) {
        return [];
      }

      const content = readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);

      return lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (parseError) {
            return null;
          }
        })
        .filter(entry => entry !== null);
    } catch (readError) {
      console.error('Failed to read failure log:', readError.message);
      return [];
    }
  }

  getFailureStats() {
    const failures = this.getRecentFailures(100);
    const stats = {
      total: failures.length,
      byTool: {},
      byErrorType: {},
      byWorkingDirectory: {},
      recentFailures: failures.slice(-5)
    };

    failures.forEach(failure => {
      // By tool
      stats.byTool[failure.toolName] = (stats.byTool[failure.toolName] || 0) + 1;

      // By error type
      const errorType = failure.error.code || failure.error.type;
      stats.byErrorType[errorType] = (stats.byErrorType[errorType] || 0) + 1;

      // By working directory
      const wd = failure.context.workingDirectory;
      stats.byWorkingDirectory[wd] = (stats.byWorkingDirectory[wd] || 0) + 1;
    });

    return stats;
  }

  clearLog() {
    try {
      if (existsSync(this.logFile)) {
        writeFileSync(this.logFile, '');
      }
    } catch (clearError) {
      console.error('Failed to clear failure log:', clearError.message);
    }
  }
}

// Global instance
export const failureLogger = new FailureLogger();