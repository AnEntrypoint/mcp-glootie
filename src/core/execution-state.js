// Shared execution state management for cross-tool status sharing
import { v4 as uuidv4 } from 'uuid';

export class ExecutionState {
  constructor() {
    this.executions = new Map();
    this.currentExecution = null;
  }

  // Start tracking a new execution
  startExecution({
    id = uuidv4(),
    type = 'execute',
    code = null,
    commands = null,
    runtime = null,
    workingDirectory = null,
    startTime = Date.now(),
    timeout = 120000
  } = {}) {
    const execution = {
      id,
      type,
      code,
      commands,
      runtime,
      workingDirectory,
      startTime,
      timeout,
      status: 'running',
      progress: 0,
      result: null,
      error: null
    };

    this.executions.set(id, execution);
    this.currentExecution = id;

    return execution;
  }

  // Complete an execution with result
  completeExecution(id, result) {
    const execution = this.executions.get(id);
    if (execution) {
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      execution.result = result;
      execution.progress = 100;

      // Keep current execution reference if it completed quickly
      if (this.currentExecution === id && execution.duration < 3000) {
        // Keep as current for cross-tool sharing
      } else if (this.currentExecution === id) {
        // Clear current if it was a long execution
        this.currentExecution = null;
      }
    }
    return execution;
  }

  // Fail an execution
  failExecution(id, error) {
    const execution = this.executions.get(id);
    if (execution) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      execution.error = error;
      this.currentExecution = null;
    }
    return execution;
  }

  // Get current execution (for cross-tool sharing)
  getCurrentExecution() {
    if (!this.currentExecution) return null;

    const execution = this.executions.get(this.currentExecution);

    // Clear current if it's too old (more than 10 seconds)
    if (execution && Date.now() - execution.startTime > 10000) {
      this.currentExecution = null;
      return null;
    }

    return execution;
  }

  // Get execution by ID
  getExecution(id) {
    return this.executions.get(id);
  }

  // Format execution status for tool output
  formatExecutionStatus(execution) {
    if (!execution) return null;

    const lines = [];
    lines.push('🔧 EXECUTION STATUS:');
    lines.push(`• ID: ${execution.id}`);
    lines.push(`• Status: ${execution.status.toUpperCase()}`);
    lines.push(`• Runtime: ${execution.runtime || 'unknown'}`);
    lines.push(`• Duration: ${execution.duration || Date.now() - execution.startTime}ms`);

    if (execution.result) {
      lines.push(`• Result: ${execution.result.success ? 'SUCCESS' : 'FAILED'}`);
      if (execution.result.stdout) {
        lines.push(`• Output: ${execution.result.stdout.substring(0, 100)}${execution.result.stdout.length > 100 ? '...' : ''}`);
      }
    }

    if (execution.error) {
      lines.push(`• Error: ${execution.error.message || execution.error}`);
    }

    return lines.join('\n');
  }

  // Clean up old executions
  cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [id, execution] of this.executions) {
      // Delete executions older than 1 hour or completed fast executions older than 1 minute
      const age = now - execution.startTime;
      if (age > 3600000 || (execution.status === 'completed' && execution.duration < 3000 && age > 60000)) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => {
      this.executions.delete(id);
      if (this.currentExecution === id) {
        this.currentExecution = null;
      }
    });
  }
}

// Global instance
export const executionState = new ExecutionState();

// Middleware function to add execution status to tool responses
export function addExecutionStatusToResponse(toolResponse, toolName) {
  const currentExecution = executionState.getCurrentExecution();

  if (!currentExecution || currentExecution.type !== 'execute') {
    return toolResponse;
  }

  const statusText = executionState.formatExecutionStatus(currentExecution);
  if (!statusText) return toolResponse;

  // Add execution status as a prefix to the response
  if (toolResponse.content && toolResponse.content[0] && toolResponse.content[0].type === 'text') {
    const originalText = toolResponse.content[0].text;
    toolResponse.content[0].text = `${statusText}\n\n${toolName.toUpperCase()} RESULTS:\n\n${originalText}`;
  }

  return toolResponse;
}

// Helper function to determine if execution should be async (purely time-based)
export function shouldExecuteAsync(estimatedDuration, code, commands) {
  // Always async if estimated duration is over 3 seconds
  return estimatedDuration > 3000;
}