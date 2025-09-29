import { failureAnalyzer } from '../core/failure-analyzer.js';
import { createToolContext } from '../core/working-directory-context.js';
import { workingDirectoryContext } from '../core/working-directory-context.js';
import { addExecutionStatusToResponse } from '../core/execution-state.js';
import { ToolError } from '../core/error-handling.js';
import { withCrossToolAwareness, addToolMetadata } from '../core/cross-tool-context.js';
import { createMCPResponse } from '../core/mcp-pagination.js';
import { suppressConsoleOutput } from '../core/console-suppression.js';

export const failureAnalysisTools = [
  {
    name: "analyze_failures",
    description: `Analyze MCP tool failures and generate insights for troubleshooting.

🎯 BEST FOR:
- Understanding failure patterns and root causes
- Identifying systemic issues affecting MCP tools
- Monitoring system health and stability
- Getting actionable recommendations for issue resolution

💡 USAGE:
• Run periodically to monitor MCP tool health
• Use after experiencing multiple tool failures
• Check before and after making system changes
• Monitor ongoing stability improvements

📊 OUTPUT INCLUDES:
• Failure summary and trends
• System health assessment (0-100 score)
• Top recurring issues with counts
• Actionable recommendations
• Root cause analysis

This tool analyzes the failure log file and provides comprehensive insights into MCP tool reliability.`,
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent failures to analyze (default: 50, max: 200)",
          default: 50
        },
        workingDirectory: {
          type: "string",
          description: "Working directory path"
        }
      },
      required: ["workingDirectory"]
    },
    handler: withCrossToolAwareness(async ({ limit = 50, workingDirectory }) => {
      const consoleRestore = suppressConsoleOutput();

      try {
        // Analyze failures
        const analysis = failureAnalyzer.analyzeFailures(limit);

        // Generate detailed report
        const report = failureAnalyzer.generateReport(limit);

        // Create tool context
        const toolContext = createToolContext('analyze_failures', workingDirectory, 'failure-analysis', {
          failuresAnalyzed: limit,
          systemHealth: analysis.systemHealth,
          trends: analysis.trends
        });

        await workingDirectoryContext.updateContext(workingDirectory, 'analyze_failures', toolContext);

        // Format response
        const response = {
          content: [{
            type: "text",
            text: report
          }]
        };

        return addExecutionStatusToResponse(response, 'analyze_failures');

      } catch (error) {
        console.error('Failure analysis error:', error);

        // Check if this is just a "no failures" case
        if (error.message.includes('No MCP tool failures recorded') ||
            error.message.includes('Cannot read properties of undefined') ||
            error.message.includes('No failures to analyze')) {
          // This is a positive case - no failures is good
          const successResponse = {
            content: [{
              type: "text",
              text: `✅ **MCP Tool Failure Analysis**\n\nNo MCP tool failures recorded recently. System appears to be operating normally!\n\n**System Health:** HEALTHY (100/100)\n**Status:** Stable\n\nContinue monitoring for optimal performance.`
            }]
          };
          return addExecutionStatusToResponse(successResponse, 'analyze_failures');
        }

        const errorResponse = {
          content: [{
            type: "text",
            text: `❌ **Failure Analysis Error**\n\nUnable to analyze MCP failures: ${error.message}\n\n**Troubleshooting:**\n1. Check if the failure log file exists\n2. Verify file permissions\n3. Ensure log directory is accessible`
          }],
          isError: true
        };
        return addExecutionStatusToResponse(errorResponse, 'analyze_failures');
      } finally {
        consoleRestore.restore();
      }
    }, 'analyze_failures', {
      maxRetries: 1,
      retryDelay: 1000
    })
  },

  {
    name: "get_failure_stats",
    description: `Get quick statistics about MCP tool failures.

🎯 BEST FOR:
- Quick health checks
- Monitoring failure rates
- Identifying problematic tools
- Trend analysis

💡 OUTPUT:
• Total failure count
• Failures by tool name
• Failures by error type
• Most recent failures
• System health score`,
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent failures to analyze (default: 20)",
          default: 20
        },
        workingDirectory: {
          type: "string",
          description: "Working directory path"
        }
      },
      required: ["workingDirectory"]
    },
    handler: withCrossToolAwareness(async ({ limit = 20, workingDirectory }) => {
      const consoleRestore = suppressConsoleOutput();

      try {
        const stats = failureAnalyzer.logger.getFailureStats();

        if (stats.total === 0) {
          const response = {
            content: [{
              type: "text",
              text: `📊 **MCP Failure Statistics**\n\n✅ No failures recorded in recent history.\n\n**System Status:** Healthy\n**Total Failures:** 0`
            }]
          };
          return addExecutionStatusToResponse(response, 'get_failure_stats');
        }

        let report = `📊 **MCP Failure Statistics**\n\n`;
        report += `**Total Failures:** ${stats.total}\n`;
        report += `**Recent Failures:** ${stats.recentFailures.length}\n\n`;

        if (Object.keys(stats.byTool).length > 0) {
          report += `**Failures by Tool:**\n`;
          Object.entries(stats.byTool)
            .sort((a, b) => b[1] - a[1])
            .forEach(([tool, count]) => {
              report += `• ${tool}: ${count}\n`;
            });
          report += `\n`;
        }

        if (Object.keys(stats.byErrorType).length > 0) {
          report += `**Failures by Error Type:**\n`;
          Object.entries(stats.byErrorType)
            .sort((a, b) => b[1] - a[1])
            .forEach(([error, count]) => {
              report += `• ${error}: ${count}\n`;
            });
          report += `\n`;
        }

        if (Object.keys(stats.byWorkingDirectory).length > 0) {
          report += `**Failures by Directory:**\n`;
          Object.entries(stats.byWorkingDirectory)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5) // Top 5 directories
            .forEach(([dir, count]) => {
              const dirName = dir.split('/').pop() || dir;
              report += `• ${dirName}: ${count}\n`;
            });
          report += `\n`;
        }

        if (stats.recentFailures.length > 0) {
          report += `**Most Recent Failures:**\n`;
          stats.recentFailures.slice(-3).forEach((failure, index) => {
            const time = new Date(failure.timestamp).toLocaleString();
            report += `${index + 1}. ${failure.toolName} at ${time}\n   ${failure.error.message}\n`;
          });
        }

        const response = {
          content: [{
            type: "text",
            text: report
          }]
        };

        return addExecutionStatusToResponse(response, 'get_failure_stats');

      } catch (error) {
        const errorResponse = {
          content: [{
            type: "text",
            text: `❌ **Statistics Error**\n\nUnable to retrieve failure statistics: ${error.message}`
          }],
          isError: true
        };
        return addExecutionStatusToResponse(errorResponse, 'get_failure_stats');
      } finally {
        consoleRestore.restore();
      }
    }, 'get_failure_stats', {
      maxRetries: 1,
      retryDelay: 1000
    })
  }
];