import { ToolError, ToolErrorHandler } from './error-handling.js';

export class EnhancedErrorHandler extends ToolErrorHandler {
  constructor(toolName = 'unknown') {
    super(toolName);
    this.toolName = toolName;
    this.startTime = Date.now();
  }

  /**
   * Enhanced error handling with logging and clear feedback
   */
  handleErrorWithFeedback(error, context = {}) {
    const startTime = this.startTime;
    const duration = Date.now() - startTime;

    // Create failure context for analysis
    const loggedFailure = {
      toolName: this.toolName,
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message
      },
      context: {
        ...context,
        duration,
        toolName: this.toolName
      },
      timestamp: new Date().toISOString()
    };

    // Get enhanced error details
    const enhancedError = this.enhanceErrorDetails(error, loggedFailure);

    return enhancedError;
  }

  /**
   * Enhance error with additional context and suggestions
   */
  enhanceErrorDetails(error, loggedFailure) {
    // Use existing error handling as base
    const baseError = this.handleError(error);

    // Add failure analysis
    const analysis = this.analyzeFailure(error, loggedFailure);

    // Generate contextual suggestions
    const suggestions = this.generateContextualSuggestions(error, loggedFailure, baseError);

    // Create enhanced error response
    const enhancedResponse = {
      success: false,
      error: {
        ...baseError.toJSON(),
        analysis: analysis,
        suggestions: suggestions,
        failureId: this.generateFailureId(),
        timestamp: new Date().toISOString()
      },
      nextSteps: this.generateNextSteps(error, loggedFailure)
    };

    return enhancedResponse;
  }

  /**
   * Analyze failure patterns and root causes
   */
  analyzeFailure(error, loggedFailure) {
    const analysis = {
      severity: this.determineSeverity(error),
      category: this.categorizeError(error),
      likelyCauses: this.identifyLikelyCauses(error),
      frequency: this.checkFrequency(loggedFailure.toolName, error.code),
      systemContext: this.getSystemContext()
    };

    return analysis;
  }

  determineSeverity(error) {
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      return 'high';
    }
    if (error.message.includes('timeout') || error.message.includes('connection')) {
      return 'medium';
    }
    if (error.message.includes('not found') || error.message.includes('invalid')) {
      return 'low';
    }
    return 'medium';
  }

  categorizeError(error) {
    if (error.code === 'ENOENT' || error.message.includes('no such file')) {
      return 'file_system';
    }
    if (error.code === 'EACCES' || error.message.includes('permission')) {
      return 'permissions';
    }
    if (error.message.includes('timeout') || error.message.includes('connection')) {
      return 'connectivity';
    }
    if (error.message.includes('memory') || error.message.includes('resource')) {
      return 'resource';
    }
    return 'general';
  }

  identifyLikelyCauses(error) {
    const causes = [];

    if (error.code === 'ENOENT') {
      causes.push('File or directory does not exist');
      causes.push('Incorrect path provided');
      causes.push('Working directory changed unexpectedly');
    }

    if (error.message.includes('timeout')) {
      causes.push('Operation took too long to complete');
      causes.push('System is under heavy load');
      causes.push('Large files or complex operations');
    }

    if (error.message.includes('connection')) {
      causes.push('Network connectivity issues');
      causes.push('MCP server connection problems');
      causes.push('External service unavailable');
    }

    if (error.message.includes('permission')) {
      causes.push('Insufficient file permissions');
      causes.push('User access restrictions');
      causes.push('Security policies blocking access');
    }

    return causes.length > 0 ? causes : ['Unknown cause - need further investigation'];
  }

  checkFrequency(toolName, errorCode) {
    // Simplified frequency check - always return 'rare' since we removed failureLogger
    return 'rare';
  }

  getSystemContext() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  generateContextualSuggestions(error, loggedFailure, baseError = null) {
    const suggestions = [];

    // Add base error suggestions if available
    if (baseError && baseError.suggestions) {
      suggestions.push(...baseError.suggestions);
    }

    // Add contextual suggestions based on error type
    if (error.code === 'ENOENT') {
      suggestions.push('Check if the working directory path is correct');
      suggestions.push('Verify the file exists in the expected location');
      suggestions.push('Use absolute paths instead of relative paths');
    }

    if (error.message.includes('timeout')) {
      suggestions.push('Try breaking the operation into smaller chunks');
      suggestions.push('Increase timeout if the operation is legitimately long-running');
      suggestions.push('Check if the system is under heavy load');
    }

    if (loggedFailure.context.pattern) {
      suggestions.push('Try modifying your AST pattern to be more specific');
      suggestions.push('Consider using simpler patterns first');
    }

    return suggestions;
  }

  generateNextSteps(error, loggedFailure) {
    const nextSteps = [];

    // Always suggest checking the logs
    nextSteps.push('Check the MCP failure logs for detailed analysis');

    // Add tool-specific next steps
    if (loggedFailure.toolName.includes('ast')) {
      nextSteps.push('Verify your AST pattern syntax is correct');
      nextSteps.push('Try simpler patterns first');
    }

    if (loggedFailure.toolName.includes('execute')) {
      nextSteps.push('Check your command syntax and parameters');
      nextSteps.push('Verify the working directory is accessible');
    }

    // Add recovery steps based on frequency
    const frequency = this.checkFrequency(loggedFailure.toolName, error.code);
    if (frequency === 'frequent') {
      nextSteps.push('This error is occurring frequently - consider restarting the MCP server');
      nextSteps.push('Check for systemic issues in your environment');
    }

    return nextSteps;
  }

  generateFailureId() {
    return `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create user-friendly error message for MCP response
   */
  createErrorResponse(error, context = {}) {
    const enhancedError = this.handleErrorWithFeedback(error, context);

    // Format for MCP response
    const userMessage = this.formatUserMessage(enhancedError);

    return {
      content: [{
        type: "text",
        text: userMessage
      }],
      isError: true,
      metadata: {
        failureId: enhancedError.error.failureId,
        severity: enhancedError.error.analysis.severity,
        category: enhancedError.error.analysis.category
      }
    };
  }

  formatUserMessage(enhancedError) {
    const error = enhancedError.error;
    const analysis = error.analysis;

    let message = `🚨 **${error.tool.toUpperCase()} TOOL FAILURE**\n\n`;

    message += `**Error:** ${error.message}\n`;
    message += `**Type:** ${error.code} (Severity: ${analysis.severity})\n\n`;

    if (analysis.likelyCauses.length > 0) {
      message += `**Likely Causes:**\n`;
      analysis.likelyCauses.forEach((cause, index) => {
        message += `${index + 1}. ${cause}\n`;
      });
      message += '\n';
    }

    if (enhancedError.suggestions.length > 0) {
      message += `**Suggestions:**\n`;
      enhancedError.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
      message += '\n';
    }

    if (enhancedError.nextSteps.length > 0) {
      message += `**Next Steps:**\n`;
      enhancedError.nextSteps.forEach((step, index) => {
        message += `${index + 1}. ${step}\n`;
      });
      message += '\n';
    }

    message += `**Failure ID:** ${error.failureId}\n`;
    message += `**Check logs:** \`glootie/mcp-failures.log\` for detailed analysis\n`;

    return message;
  }
}

export function createEnhancedErrorHandler(toolName) {
  return new EnhancedErrorHandler(toolName);
}