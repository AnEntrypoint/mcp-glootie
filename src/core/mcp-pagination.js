import { generateId } from './utilities.js';



class PaginationManager {
  constructor() {
    this.cursors = new Map();
    this.defaultPageSize = 50;
    this.maxCursorAge = 30 * 60 * 1000; 
  }

  
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

  
  getCursor(cursorId) {
    const cursor = this.cursors.get(cursorId);
    if (!cursor) {
      throw new Error('Invalid or expired cursor');
    }

    
    if (Date.now() - cursor.timestamp > this.maxCursorAge) {
      this.cursors.delete(cursorId);
      throw new Error('Cursor expired');
    }

    return cursor;
  }

  
  removeCursor(cursorId) {
    this.cursors.delete(cursorId);
  }

  
  cleanup() {
    const now = Date.now();
    const expiredTime = now - this.maxCursorAge;

    for (const [cursorId, cursor] of this.cursors.entries()) {
      if (cursor.timestamp < expiredTime) {
        this.cursors.delete(cursorId);
      }
    }
  }

  
  createPaginatedResponse(items, cursor = null, pageSize = null) {
    this.cleanup();
    const effectivePageSize = pageSize || this.defaultPageSize;

    if (!cursor) {
      
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
        
        this.removeCursor(cursor);
      }

      return response;
    } catch (error) {
      throw new Error(`Invalid cursor: ${error.message}`);
    }
  }
}

const paginationManager = new PaginationManager();


export function createMCPResponse(data, options = {}) {
  const {
    cursor = null,
    pageSize = null,
    transform = null,
    metadata = {}
  } = options;

  
  const items = transform ? data.map(transform) : data;

  const response = paginationManager.createPaginatedResponse(items, cursor, pageSize);

  
  if (Object.keys(metadata).length > 0) {
    response.metadata = metadata;
  }

  return response;
}


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


export function createResourceResponse(resources, options = {}) {
  return createMCPResponse(resources, {
    ...options,
    metadata: {
      type: 'resource-list',
      ...options.metadata
    }
  });
}


export function createPaginationError(error) {
  return {
    items: [],
    hasNext: false,
    error: error.message,
    isError: true
  };
}


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

        
        return {
          content: [{ type: "text", text: JSON.stringify(paginatedResult, null, 2) }]
        };
      }

      
      if (result && result.content) {
        return result;
      }

      return {
        content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
      };
    } catch (error) {
      
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  };
}

export default paginationManager;