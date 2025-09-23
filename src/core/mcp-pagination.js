import { generateId } from './utilities.js';

/**
 * Standardized MCP Pagination Handler
 * Implements the MCP pagination specification with opaque cursors
 */

class PaginationManager {
  constructor() {
    this.cursors = new Map();
    this.defaultPageSize = 50;
    this.maxCursorAge = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Create an opaque cursor for pagination
   * @param {Array} data - The data to paginate
   * @param {number} position - Current position in data
   * @returns {string} Opaque cursor token
   */
  createCursor(data, position = 0) {
    const cursorId = generateId();
    this.cursors.set(cursorId, {
      data,
      position,
      timestamp: Date.now(),
      totalItems: data.length
    });
    return cursorId;
  }

  /**
   * Retrieve data from cursor
   * @param {string} cursorId - The opaque cursor
   * @returns {Object} Cursor data with remaining items
   */
  getCursor(cursorId) {
    const cursor = this.cursors.get(cursorId);
    if (!cursor) {
      throw new Error('Invalid or expired cursor');
    }

    // Check if cursor is expired
    if (Date.now() - cursor.timestamp > this.maxCursorAge) {
      this.cursors.delete(cursorId);
      throw new Error('Cursor expired');
    }

    return cursor;
  }

  /**
   * Remove cursor after use
   * @param {string} cursorId - The cursor to remove
   */
  removeCursor(cursorId) {
    this.cursors.delete(cursorId);
  }

  /**
   * Clean up expired cursors
   */
  cleanup() {
    const now = Date.now();
    const expiredTime = now - this.maxCursorAge;

    for (const [cursorId, cursor] of this.cursors.entries()) {
      if (cursor.timestamp < expiredTime) {
        this.cursors.delete(cursorId);
      }
    }
  }

  /**
   * Create paginated response following MCP specification
   * @param {Array} items - All items to paginate
   * @param {string|null} cursor - Opaque cursor from previous request
   * @param {number} pageSize - Items per page
   * @returns {Object} MCP pagination response
   */
  createPaginatedResponse(items, cursor = null, pageSize = null) {
    this.cleanup();
    const effectivePageSize = pageSize || this.defaultPageSize;

    if (!cursor) {
      // First page
      const pageItems = items.slice(0, effectivePageSize);
      const hasNext = items.length > effectivePageSize;

      const response = {
        items: pageItems,
        hasNext,
        totalItems: items.length
      };

      if (hasNext) {
        const remainingItems = items.slice(effectivePageSize);
        response.nextCursor = this.createCursor(remainingItems, effectivePageSize);
      }

      return response;
    }

    // Subsequent page
    try {
      const cursorData = this.getCursor(cursor);
      const remainingItems = cursorData.data;
      const pageItems = remainingItems.slice(0, effectivePageSize);
      const hasNext = remainingItems.length > effectivePageSize;

      const response = {
        items: pageItems,
        hasNext,
        totalItems: cursorData.totalItems
      };

      if (hasNext) {
        const newRemaining = remainingItems.slice(effectivePageSize);
        response.nextCursor = this.createCursor(newRemaining, cursorData.position + effectivePageSize);
      } else {
        // No more pages, clean up cursor
        this.removeCursor(cursor);
      }

      return response;
    } catch (error) {
      throw new Error(`Invalid cursor: ${error.message}`);
    }
  }
}

// Global pagination manager instance
const paginationManager = new PaginationManager();

/**
 * Create a paginated response for any data type
 * @param {Array} data - Data to paginate
 * @param {Object} options - Pagination options
 * @returns {Object} MCP pagination response
 */
export function createMCPResponse(data, options = {}) {
  const {
    cursor = null,
    pageSize = null,
    transform = null,
    metadata = {}
  } = options;

  // Apply transformation if provided
  const items = transform ? data.map(transform) : data;

  const response = paginationManager.createPaginatedResponse(items, cursor, pageSize);

  // Add metadata if provided
  if (Object.keys(metadata).length > 0) {
    response.metadata = metadata;
  }

  return response;
}

/**
 * Create a resource reference for MCP pagination
 * @param {string} uri - Resource URI
 * @param {string} name - Human-readable name
 * @param {Object} metadata - Additional metadata
 * @returns {Object} MCP resource reference
 */
export function createResourceReference(uri, name, metadata = {}) {
  return {
    uri,
    name,
    metadata: {
      ...metadata,
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Create a paginated resource response
 * @param {Array} resources - Array of resource references
 * @param {Object} options - Pagination options
 * @returns {Object} MCP paginated resource response
 */
export function createResourceResponse(resources, options = {}) {
  return createMCPResponse(resources, {
    ...options,
    metadata: {
      type: 'resource-list',
      ...options.metadata
    }
  });
}

/**
 * Handle pagination errors gracefully
 * @param {Error} error - The error that occurred
 * @returns {Object} MCP error response
 */
export function createPaginationError(error) {
  return {
    items: [],
    hasNext: false,
    error: error.message,
    isError: true
  };
}

/**
 * Middleware wrapper for pagination handlers
 * @param {Function} handler - The handler function to wrap
 * @param {string} resourceName - Name of the resource being paginated
 * @returns {Function} Wrapped handler
 */
export function withPagination(handler, resourceName = 'items') {
  return async (args) => {
    try {
      const result = await handler(args);

      if (Array.isArray(result)) {
        const paginatedResult = createMCPResponse(result, {
          cursor: args.cursor,
          pageSize: args.pageSize,
          metadata: {
            resource: resourceName,
            timestamp: new Date().toISOString()
          }
        });

        // Return in MCP content format to ensure hooks are applied
        return {
          content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }]
        };
      }

      // If not an array, ensure it's in MCP content format
      if (result && result.content) {
        return result;
      }

      return {
        content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      // Return error in MCP content format
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  };
}

export default paginationManager;