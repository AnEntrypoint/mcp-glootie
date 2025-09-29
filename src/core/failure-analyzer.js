import { failureLogger } from './failure-logger.js';

export class FailureAnalyzer {
  constructor() {
    this.logger = failureLogger;
  }

  /**
   * Analyze recent failures and provide insights
   */
  analyzeFailures(limit = 50) {
    const failures = this.logger.getRecentFailures(limit);

    if (failures.length === 0) {
      return {
        summary: 'No MCP tool failures recorded recently.',
        insights: [],
        recommendations: [],
        trends: 'stable'
      };
    }

    const analysis = {
      summary: this.generateSummary(failures),
      insights: this.generateInsights(failures),
      recommendations: this.generateRecommendations(failures),
      trends: this.identifyTrends(failures),
      topIssues: this.getTopIssues(failures),
      systemHealth: this.assessSystemHealth(failures)
    };

    return analysis;
  }

  generateSummary(failures) {
    const total = failures.length;
    const uniqueTools = new Set(failures.map(f => f.toolName)).size;

    if (total === 0) {
      return 'No failures to analyze.';
    }

    const latest = failures[failures.length - 1];
    const oldest = failures[0];

    const timeSpan = new Date(latest.timestamp) - new Date(oldest.timestamp);
    const hours = timeSpan / (1000 * 60 * 60);

    return `Analyzed ${total} failures across ${uniqueTools} tools over ${hours.toFixed(1)} hours. Latest failure: ${latest.toolName} at ${new Date(latest.timestamp).toLocaleString()}.`;
  }

  generateInsights(failures) {
    const insights = [];

    // Tool-specific insights
    const toolCounts = {};
    failures.forEach(f => {
      toolCounts[f.toolName] = (toolCounts[f.toolName] || 0) + 1;
    });

    const topTool = Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0];
    if (topTool[1] > failures.length * 0.3) {
      insights.push(`${topTool[0]} is experiencing ${topTool[1]} failures (${((topTool[1] / failures.length) * 100).toFixed(1)}% of total) - may need investigation.`);
    }

    // Error type insights
    const errorTypes = {};
    failures.forEach(f => {
      const errorType = f.error.code || f.error.type;
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    const frequentErrors = Object.entries(errorTypes).filter(([_, count]) => count > 2);
    if (frequentErrors.length > 0) {
      insights.push(`Frequent error patterns: ${frequentErrors.map(([type, count]) => `${type} (${count})`).join(', ')}`);
    }

    // Working directory insights
    const wdCounts = {};
    failures.forEach(f => {
      const wd = f.context.workingDirectory;
      wdCounts[wd] = (wdCounts[wd] || 0) + 1;
    });

    const problematicWd = Object.entries(wdCounts).sort((a, b) => b[1] - a[1])[0];
    if (problematicWd[1] > 3) {
      insights.push(`Working directory ${problematicWd[0]} has ${problematicWd[1]} failures - check permissions or path issues.`);
    }

    // Timeout insights
    const timeouts = failures.filter(f =>
      f.error.message.includes('timeout') || f.error.code === 'TIMEOUT'
    );
    if (timeouts.length > failures.length * 0.2) {
      insights.push(`${timeouts.length} timeout failures (${((timeouts.length / failures.length) * 100).toFixed(1)}%) - consider increasing timeouts or optimizing performance.`);
    }

    return insights;
  }

  generateRecommendations(failures) {
    const recommendations = [];

    // Check for systematic issues
    const recentFailures = failures.slice(-10);
    const errorCounts = {};
    recentFailures.forEach(f => {
      errorCounts[f.error.code] = (errorCounts[f.error.code] || 0) + 1;
    });

    // Permission errors
    const permissionErrors = failures.filter(f =>
      f.error.code === 'EACCES' || f.error.message.includes('permission')
    );
    if (permissionErrors.length > 0) {
      recommendations.push('Review file permissions - multiple permission-related failures detected');
    }

    // File not found errors
    const fileErrors = failures.filter(f =>
      f.error.code === 'ENOENT' || f.error.message.includes('no such file')
    );
    if (fileErrors.length > 0) {
      recommendations.push('Check working directory paths and file existence - multiple file-related failures');
    }

    // Connection issues
    const connectionErrors = failures.filter(f =>
      f.error.message.includes('connection') || f.error.code === 'CONNERROR'
    );
    if (connectionErrors.length > 0) {
      recommendations.push('Network connectivity issues detected - check external service availability');
    }

    // Memory/resource issues
    const resourceErrors = failures.filter(f =>
      f.error.message.includes('memory') || f.error.message.includes('resource') || f.error.code === 'ENOMEM'
    );
    if (resourceErrors.length > 0) {
      recommendations.push('Resource constraints detected - monitor memory usage and consider optimizing operations');
    }

    // General recommendations
    if (failures.length > 20) {
      recommendations.push('High failure rate detected - consider restarting MCP server and investigating systemic issues');
    }

    recommendations.push('Regular monitoring: Check glootie/mcp-failures.log for ongoing failure patterns');

    return recommendations;
  }

  identifyTrends(failures) {
    if (failures.length < 5) {
      return 'stable';
    }

    // Group failures by hour
    const hourlyFailures = {};
    failures.forEach(f => {
      const hour = new Date(f.timestamp).getHours();
      hourlyFailures[hour] = (hourlyFailures[hour] || 0) + 1;
    });

    // Check for increasing trend
    const recentFailures = failures.slice(-10);
    const olderFailures = failures.slice(0, 10);

    if (recentFailures.length > olderFailures.length * 1.5) {
      return 'increasing';
    } else if (recentFailures.length < olderFailures.length * 0.5) {
      return 'decreasing';
    }

    // Check for concentration in specific time periods
    const maxHourlyFailures = Math.max(...Object.values(hourlyFailures));
    const avgHourlyFailures = failures.length / 24;

    if (maxHourlyFailures > avgHourlyFailures * 3) {
      return 'sporadic';
    }

    return 'stable';
  }

  getTopIssues(failures) {
    const issueCounts = {};

    failures.forEach(f => {
      const key = `${f.toolName}:${f.error.code}`;
      issueCounts[key] = (issueCounts[key] || 0) + 1;
    });

    return Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => {
        const [tool, error] = issue.split(':');
        return { tool, error, count };
      });
  }

  assessSystemHealth(failures) {
    const total = failures.length;
    const uniqueTools = new Set(failures.map(f => f.toolName)).size;
    const uniqueErrors = new Set(failures.map(f => f.error.code || f.error.type)).size;

    if (total === 0) {
      return {
        score: 100,
        status: 'healthy',
        factors: {
          totalFailures: 0,
          uniqueToolsAffected: 0,
          uniqueErrorTypes: 0,
          criticalErrors: 0
        }
      };
    }

    // Calculate health score (0-100)
    let healthScore = 100;

    // Deduct for failure volume
    healthScore -= Math.min(total * 2, 30);

    // Deduct for tool spread
    healthScore -= Math.min(uniqueTools * 5, 20);

    // Deduct for error variety
    healthScore -= Math.min(uniqueErrors * 3, 15);

    // Check for critical errors
    const criticalErrors = failures.filter(f =>
      ['ENOENT', 'EACCES', 'CONNERROR'].includes(f.error.code)
    );
    healthScore -= Math.min(criticalErrors.length * 10, 20);

    healthScore = Math.max(0, healthScore);

    let status = 'healthy';
    if (healthScore < 40) {
      status = 'critical';
    } else if (healthScore < 70) {
      status = 'warning';
    } else if (healthScore < 90) {
      status = 'degraded';
    }

    return {
      score: healthScore,
      status,
      factors: {
        totalFailures: total,
        uniqueToolsAffected: uniqueTools,
        uniqueErrorTypes: uniqueErrors,
        criticalErrors: criticalErrors.length
      }
    };
  }

  /**
   * Get a formatted report for display
   */
  generateReport(limit = 50) {
    const analysis = this.analyzeFailures(limit);

    let report = `🔍 **MCP Tool Failure Analysis Report**\n\n`;
    report += `**Summary:** ${analysis.summary}\n\n`;

    report += `**System Health:** ${analysis.systemHealth.status.toUpperCase()} (${analysis.systemHealth.score}/100)\n`;
    report += `**Trend:** ${analysis.trends.toUpperCase()}\n\n`;

    if (analysis.insights.length > 0) {
      report += `**📊 Insights:**\n`;
      analysis.insights.forEach((insight, index) => {
        report += `${index + 1}. ${insight}\n`;
      });
      report += `\n`;
    }

    if (analysis.topIssues.length > 0) {
      report += `**🔥 Top Issues:**\n`;
      analysis.topIssues.forEach((issue, index) => {
        report += `${index + 1}. ${issue.tool} - ${issue.error} (${issue.count} occurrences)\n`;
      });
      report += `\n`;
    }

    if (analysis.recommendations.length > 0) {
      report += `**💡 Recommendations:**\n`;
      analysis.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += `\n`;
    }

    report += `**📝 Next Steps:**\n`;
    report += `• Review detailed logs in \`glootie/mcp-failures.log\`\n`;
    report += `• Monitor system health score: ${analysis.systemHealth.score}/100\n`;
    report += `• Address critical issues first\n`;

    return report;
  }
}

export const failureAnalyzer = new FailureAnalyzer();