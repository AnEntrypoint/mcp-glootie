import { ToolError, ToolErrorHandler } from './error-handling.js';

export class ConnectionError extends ToolError {
  constructor(message, toolName = 'connection-manager') {
    super(message, 'CONNECTION_ERROR', toolName, true, [
      'Check if the MCP server is running',
      'Verify the connection parameters',
      'Try re-establishing the connection',
      'Check network connectivity'
    ]);
    this.name = 'ConnectionError';
  }
}

export class CircuitBreakerError extends ToolError {
  constructor(message, toolName = 'connection-manager') {
    super(message, 'CIRCUIT_BREAKER_OPEN', toolName, false, [
      'The circuit is currently open to prevent cascading failures',
      'Wait for the reset timeout before retrying',
      'Check the underlying issue that caused the circuit to open',
      'Try a different approach or tool'
    ]);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 300000; // 5 minutes
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'closed'; // closed, open, half-open
    this.successCount = 0;
    this.consecutiveFailures = 0;
    this.errors = [];
  }

  async execute(operation, context = {}) {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.resetTimeout) {
        throw new CircuitBreakerError(
          `Circuit breaker is open - preventing operation to avoid cascading failures. ${this.failureCount} failures detected.`,
          context.toolName || 'unknown'
        );
      } else {
        this.state = 'half-open';
        console.log('Circuit breaker transitioning to half-open state');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error, context);
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.consecutiveFailures = 0;
    this.successCount++;

    if (this.state === 'half-open') {
      this.state = 'closed';
      console.log('Circuit breaker closed after successful operation');
    }
  }

  onFailure(error, context = {}) {
    this.failureCount++;
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    this.errors.push({
      error: error.message,
      timestamp: Date.now(),
      context
    });

    // Keep only recent errors for analysis
    if (this.errors.length > 10) {
      this.errors = this.errors.slice(-10);
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.warn(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      consecutiveFailures: this.consecutiveFailures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeUntilReset: this.state === 'open' ?
        Math.max(0, this.resetTimeout - (Date.now() - this.lastFailureTime)) : 0,
      recentErrors: this.errors.slice(-5)
    };
  }

  reset() {
    this.failureCount = 0;
    this.consecutiveFailures = 0;
    this.successCount = 0;
    this.state = 'closed';
    this.lastFailureTime = null;
    this.errors = [];
    console.log('Circuit breaker manually reset');
  }
}

export class ConnectionManager {
  constructor(options = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.connectionTimeout = options.connectionTimeout || 30000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.connection = null;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.heartbeatTimer = null;
    this.errorHandler = new ToolErrorHandler('connection-manager');
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker || {});
    this.connectionListeners = [];
    this.errorListeners = [];

    // Track connection health
    this.connectionStats = {
      totalConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnections: 0,
      lastConnectedTime: null,
      lastDisconnectedTime: null,
      uptime: 0
    };
  }

  async ensureConnection() {
    if (!this.connection || !this.isConnected) {
      return await this.reconnect();
    }
    return this.connection;
  }

  async connect() {
    return this.circuitBreaker.execute(async () => {
      try {
        this.connectionStats.totalConnections++;

        // Simulate connection establishment
        // In a real implementation, this would establish the actual MCP connection
        this.connection = {
          id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          established: Date.now(),
          isHealthy: () => this.isConnected
        };

        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.connectionStats.successfulConnections++;
        this.connectionStats.lastConnectedTime = Date.now();

        this.notifyConnectionListeners('connected');
        this.startHeartbeat();

        console.log(`Connection established: ${this.connection.id}`);
        return this.connection;
      } catch (error) {
        this.connectionStats.failedConnections++;
        this.isConnected = false;
        this.connectionStats.lastDisconnectedTime = Date.now();

        this.notifyConnectionListeners('disconnected');
        throw new ConnectionError(
          `Failed to establish connection: ${error.message}`,
          'connection-manager'
        );
      }
    }, { toolName: 'connection-manager' });
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new ConnectionError(
        `Max reconnection attempts (${this.maxReconnectAttempts}) reached`,
        'connection-manager'
      );
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} after ${delay}ms`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const result = await this.connect();
      this.connectionStats.reconnections++;
      this.reconnectAttempts = 0; // Reset on successful reconnection
      return result;
    } catch (error) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        return this.reconnect(); // Try again
      }
      throw error; // Propagate error if max attempts reached
    }
  }

  async disconnect() {
    this.stopHeartbeat();

    if (this.connection) {
      this.isConnected = false;
      this.connectionStats.lastDisconnectedTime = Date.now();

      // Calculate uptime
      if (this.connectionStats.lastConnectedTime) {
        this.connectionStats.uptime +=
          (this.connectionStats.lastDisconnectedTime - this.connectionStats.lastConnectedTime);
      }

      this.notifyConnectionListeners('disconnected');

      console.log(`Connection disconnected: ${this.connection.id}`);
      this.connection = null;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat(); // Clear any existing heartbeat

    this.heartbeatTimer = setInterval(async () => {
      try {
        if (this.connection && this.isConnected) {
          // Perform health check
          const isHealthy = this.connection.isHealthy();
          if (!isHealthy) {
            console.warn('Connection health check failed, attempting reconnection...');
            await this.handleConnectionFailure();
          }
        }
      } catch (error) {
        console.error('Heartbeat failed:', error.message);
        await this.handleConnectionFailure();
      }
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async handleConnectionFailure() {
    this.isConnected = false;
    this.connectionStats.lastDisconnectedTime = Date.now();
    this.notifyConnectionListeners('disconnected');

    try {
      await this.reconnect();
    } catch (error) {
      this.notifyErrorListeners(error);
    }
  }

  async executeWithRetry(operation, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    const toolName = options.toolName || 'unknown';

    return this.circuitBreaker.execute(async () => {
      let lastError;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Ensure we have a connection
          await this.ensureConnection();

          // Execute the operation
          const result = await operation();
          return result;

        } catch (error) {
          lastError = error;

          // Handle connection errors specially
          if (this.isConnectionError(error)) {
            console.warn(`Connection error on attempt ${attempt}/${maxRetries}:`, error.message);

            // Try to reconnect before retrying
            try {
              await this.handleConnectionFailure();
            } catch (reconnectError) {
              console.error('Reconnection failed:', reconnectError.message);
            }

            // If this is the last attempt, throw the error
            if (attempt === maxRetries) {
              break;
            }

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          } else {
            // Non-connection error - throw immediately
            throw error;
          }
        }
      }

      throw lastError;
    }, { toolName });
  }

  isConnectionError(error) {
    const connectionErrorPatterns = [
      'connection closed',
      'connection lost',
      'connection timeout',
      'connection refused',
      'connection reset',
      'econnrefused',
      'econnreset',
      'etimedout',
      'not connected',
      'connection failed'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return connectionErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }

  // Event listener management
  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
  }

  onError(callback) {
    this.errorListeners.push(callback);
  }

  notifyConnectionListeners(status) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(status, this.getConnectionInfo());
      } catch (error) {
        console.error('Connection listener error:', error.message);
      }
    });
  }

  notifyErrorListeners(error) {
    this.errorListeners.forEach(listener => {
      try {
        listener(error, this.getConnectionInfo());
      } catch (err) {
        console.error('Error listener error:', err.message);
      }
    });
  }

  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      connectionId: this.connection?.id,
      reconnectAttempts: this.reconnectAttempts,
      circuitBreaker: this.circuitBreaker.getState(),
      stats: this.connectionStats
    };
  }

  getStats() {
    return {
      ...this.connectionStats,
      circuitBreaker: this.circuitBreaker.getState(),
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      currentConnectionId: this.connection?.id
    };
  }

  reset() {
    this.circuitBreaker.reset();
    this.disconnect();
    this.reconnectAttempts = 0;
    console.log('Connection manager reset');
  }
}

// Global connection manager instance
let globalConnectionManager = null;

export function getGlobalConnectionManager(options = {}) {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager(options);
  }
  return globalConnectionManager;
}

export function resetGlobalConnectionManager() {
  if (globalConnectionManager) {
    globalConnectionManager.reset();
    globalConnectionManager = null;
  }
}

// Utility function to wrap any tool operation with connection management
export function withConnectionManagement(handler, toolName, options = {}) {
  const connectionManager = getGlobalConnectionManager(options.connectionManager || {});

  return async (args) => {
    try {
      return await connectionManager.executeWithRetry(
        () => handler(args),
        {
          toolName,
          maxRetries: options.maxRetries || 3,
          retryDelay: options.retryDelay || 1000
        }
      );
    } catch (error) {
      // Ensure all errors are handled gracefully
      const errorHandler = new ToolErrorHandler(toolName);
      const toolError = errorHandler.handleError(error);

      // Safely log error details without using toJSON which might fail
      try {
        console.error(`Connection-managed error in ${toolName}:`, {
          code: toolError.code,
          message: toolError.message,
          tool: toolError.tool,
          timestamp: toolError.timestamp,
          retryable: toolError.retryable,
          suggestions: toolError.suggestions
        });
      } catch (logError) {
        console.error(`Connection-managed error in ${toolName}:`, toolError.message || 'Unknown error');
      }

      const errorText = [
        `${toolError.code}: ${toolError.message}`,
        '',
        'Suggestions:',
        ...toolError.suggestions.map(s => `• ${s}`)
      ].join('\n');

      return {
        content: [{ type: "text", text: errorText }],
        isError: true
      };
    }
  };
}