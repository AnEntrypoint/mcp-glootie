/**
 * Supabase Helper for REPL
 * 
 * This module provides simplified utilities for working with Supabase in the REPL.
 * It handles authentication, queries, mutations, RPC calls, and other common operations.
 */

// Create a Supabase client for the REPL
function createSupabaseClient({ url, key, options = {} } = {}) {
  // Use environment variables if not provided
  const supabaseUrl = url || env.SUPABASE_URL;
  const supabaseKey = key || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    throw new Error('Supabase URL not provided. Set SUPABASE_URL in environment or pass it as an argument.');
  }
  
  if (!supabaseKey) {
    throw new Error('Supabase API key not provided. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in environment or pass it as an argument.');
  }

  // Default options with timeouts
  const defaultOptions = {
    timeouts: {
      default: 10000,      // 10 seconds default
      functions: 30000,    // 30 seconds for edge functions
      storage: 60000,      // 60 seconds for storage operations
      sql: 30000           // 30 seconds for SQL queries
    },
    retries: {
      maxRetries: 2,       // Maximum number of retries
      retryDelay: 1000,    // Base delay between retries (ms)
      exponentialBackoff: true, // Use exponential backoff for retries
    },
    ...options
  };
  
  // Helper to make authenticated requests to Supabase API with timeout and retries
  async function fetchWithAuth(path, fetchOptions = {}, operationType = 'default') {
    const fullPath = path.startsWith('http') 
      ? path 
      : `${supabaseUrl}${path.startsWith('/') ? path : '/' + path}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      ...fetchOptions.headers
    };

    // Get appropriate timeout from operationType
    const timeout = defaultOptions.timeouts[operationType] || defaultOptions.timeouts.default;
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    let attempt = 0;
    let lastError = null;
    
    while (attempt <= defaultOptions.retries.maxRetries) {
      try {
        console.log(`Making request to ${fullPath}...${attempt > 0 ? ` (Retry ${attempt}/${defaultOptions.retries.maxRetries})` : ''}`);
        
        const response = await fetch(fullPath, {
          ...fetchOptions,
          headers,
          signal: controller.signal
        });
        
        // Clear timeout as request completed
        clearTimeout(timeoutId);
        
        // Handle non-OK responses
        if (!response.ok) {
          const errorText = await response.text();
          try {
            // Try to parse as JSON
            const errorJson = JSON.parse(errorText);
            throw new Error(`HTTP error ${response.status}: ${JSON.stringify(errorJson)}`);
          } catch (e) {
            // If not JSON, use text
            throw new Error(`HTTP error ${response.status}: ${errorText}`);
          }
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        // Clean up timeout if error happens
        clearTimeout(timeoutId);
        
        // Handle specific abort error
        if (error.name === 'AbortError') {
          console.error(`Request to ${fullPath} timed out after ${timeout}ms`);
          throw new Error(`Request timed out after ${timeout}ms`);
        }
        
        // If it's the last attempt, rethrow
        if (attempt >= defaultOptions.retries.maxRetries) {
          console.error(`Final fetch error for ${fullPath}: ${error.message}`);
          throw error;
        }
        
        // Calculate delay for retry
        const delay = defaultOptions.retries.exponentialBackoff
          ? defaultOptions.retries.retryDelay * Math.pow(2, attempt)
          : defaultOptions.retries.retryDelay;
        
        console.log(`Fetch error: ${error.message}. Retrying in ${delay}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }
    
    // This should never be reached due to the throw in the catch block
    throw lastError || new Error('Unknown fetch error');
  }
  
  // Helper for safely invoking Edge Functions with better error handling 
  async function safeInvokeFunction(functionName, payload = {}, options = {}) {
    try {
      // Use functions timeout
      const response = await fetchWithAuth(`/functions/v1/${functionName}`, {
        method: 'POST',
        body: JSON.stringify(payload),
        ...options
      }, 'functions');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error invoking function '${functionName}':`, error.message);
      throw error;
    }
  }
  
  // Create a client object with methods for common operations
  return {
    // Raw fetch with authentication for custom requests
    fetch: fetchWithAuth,
    
    // Get the URL and key being used
    getConfig: () => ({ 
      url: supabaseUrl, 
      key: supabaseKey,
      isServiceRole: supabaseKey === env.SUPABASE_SERVICE_ROLE_KEY
    }),
    
    // Database query methods
    db: {
      // Select data from a table
      select: async (table, options = {}) => {
        const { 
          columns = '*', 
          filter = {}, 
          limit = null, 
          offset = null,
          order = null,
          single = false
        } = options;
        
        let query = `/rest/v1/${table}?select=${encodeURIComponent(columns)}`;
        
        // Apply filters
        if (Object.keys(filter).length > 0) {
          for (const [key, value] of Object.entries(filter)) {
            if (typeof value === 'object' && value !== null) {
              // Handle operators like eq, gt, lt, etc.
              for (const [op, opValue] of Object.entries(value)) {
                query += `&${key}=${op}.${encodeURIComponent(opValue)}`;
              }
            } else {
              // Simple equality
              query += `&${key}=eq.${encodeURIComponent(value)}`;
            }
          }
        }
        
        // Apply limit
        if (limit !== null) {
          query += `&limit=${limit}`;
        }
        
        // Apply offset
        if (offset !== null) {
          query += `&offset=${offset}`;
        }
        
        // Apply ordering
        if (order !== null) {
          if (typeof order === 'string') {
            query += `&order=${encodeURIComponent(order)}`;
          } else if (Array.isArray(order)) {
            order.forEach(o => {
              query += `&order=${encodeURIComponent(o)}`;
            });
          }
        }
        
        // Get a single result
        if (single) {
          query += '&limit=1';
        }
        
        const response = await fetchWithAuth(query);
        const data = await response.json();
        
        return single ? (data.length > 0 ? data[0] : null) : data;
      },
      
      // Insert data into a table
      insert: async (table, data, options = {}) => {
        const { 
          returning = 'minimal',  // minimal or representation
          single = true
        } = options;
        
        const response = await fetchWithAuth(`/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'Prefer': `return=${returning}${single ? ';count=exact' : ''}`
          },
          body: JSON.stringify(Array.isArray(data) ? data : [data])
        });
        
        if (returning === 'minimal') {
          return { 
            status: response.status,
            count: parseInt(response.headers.get('content-range')?.split('/')[1] || '0')
          };
        } else {
          const result = await response.json();
          return single && Array.isArray(result) && result.length === 1 ? result[0] : result;
        }
      },
      
      // Update data in a table
      update: async (table, data, filter, options = {}) => {
        const { 
          returning = 'minimal'  // minimal or representation
        } = options;
        
        let query = `/rest/v1/${table}`;
        
        // Apply filters
        if (Object.keys(filter).length > 0) {
          for (const [key, value] of Object.entries(filter)) {
            if (typeof value === 'object' && value !== null) {
              // Handle operators like eq, gt, lt, etc.
              for (const [op, opValue] of Object.entries(value)) {
                query += (query.includes('?') ? '&' : '?') + 
                  `${key}=${op}.${encodeURIComponent(opValue)}`;
              }
            } else {
              // Simple equality
              query += (query.includes('?') ? '&' : '?') + 
                `${key}=eq.${encodeURIComponent(value)}`;
            }
          }
        }
        
        const response = await fetchWithAuth(query, {
          method: 'PATCH',
          headers: {
            'Prefer': `return=${returning}`
          },
          body: JSON.stringify(data)
        });
        
        if (returning === 'minimal') {
          return { 
            status: response.status,
            count: parseInt(response.headers.get('content-range')?.split('/')[1] || '0')
          };
        } else {
          return await response.json();
        }
      },
      
      // Delete data from a table
      delete: async (table, filter, options = {}) => {
        const { 
          returning = 'minimal'  // minimal or representation
        } = options;
        
        let query = `/rest/v1/${table}`;
        
        // Apply filters - REQUIRED for safety
        if (Object.keys(filter).length === 0) {
          throw new Error('Filter is required for delete operations for safety.');
        }
        
        for (const [key, value] of Object.entries(filter)) {
          if (typeof value === 'object' && value !== null) {
            // Handle operators like eq, gt, lt, etc.
            for (const [op, opValue] of Object.entries(value)) {
              query += (query.includes('?') ? '&' : '?') + 
                `${key}=${op}.${encodeURIComponent(opValue)}`;
            }
          } else {
            // Simple equality
            query += (query.includes('?') ? '&' : '?') + 
              `${key}=eq.${encodeURIComponent(value)}`;
          }
        }
        
        const response = await fetchWithAuth(query, {
          method: 'DELETE',
          headers: {
            'Prefer': `return=${returning}`
          }
        });
        
        if (returning === 'minimal') {
          return { 
            status: response.status,
            count: parseInt(response.headers.get('content-range')?.split('/')[1] || '0')
          };
        } else {
          return await response.json();
        }
      },
      
      // Execute raw SQL (only available with service role key)
      sql: async (query, params = {}) => {
        if (supabaseKey !== env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('SQL queries can only be executed with a service role key.');
        }
        
        const response = await fetchWithAuth('/rest/v1/rpc/execute_sql', {
          method: 'POST',
          body: JSON.stringify({
            query,
            params
          })
        }, 'sql');
        
        return await response.json();
      }
    },
    
    // Functions API
    functions: {
      // Invoke a Supabase Edge Function
      invoke: async (functionName, payload = {}, options = {}) => {
        return await safeInvokeFunction(functionName, payload, options);
      },
      
      // Helper for wrappedsupabase function
      wrapped: {
        // Execute SQL via the wrappedsupabase function
        sql: async (sql, params = {}, options = {}) => {
          return await safeInvokeFunction('wrappedsupabase', {
            path: ['sql'],
            params: { sql, ...params }
          }, options);
        },
        
        // Execute a stored procedure via the wrappedsupabase function
        rpc: async (procedure, params = {}, options = {}) => {
          return await safeInvokeFunction('wrappedsupabase', {
            path: ['rpc', procedure],
            params
          }, options);
        },
        
        // Get data from a table via wrappedsupabase function
        from: async (table, options = {}) => {
          const { select, filter = {}, limit, offset, order, single = false } = options;
          
          return await safeInvokeFunction('wrappedsupabase', {
            path: ['from', table],
            params: {
              select,
              filter,
              limit,
              offset,
              order,
              single
            }
          });
        }
      }
    },
    
    // Storage API
    storage: {
      // List buckets
      listBuckets: async () => {
        const response = await fetchWithAuth('/storage/v1/bucket', {
          method: 'GET'
        }, 'storage');
        
        return await response.json();
      },
      
      // List files in a bucket
      listFiles: async (bucketName, path = '') => {
        const query = path ? `?prefix=${encodeURIComponent(path)}` : '';
        const response = await fetchWithAuth(`/storage/v1/object/list/${bucketName}${query}`, {
          method: 'GET'
        }, 'storage');
        
        return await response.json();
      },
      
      // Get a public URL for a file
      getPublicUrl: (bucketName, path) => {
        return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${path}`;
      }
    },
    
    // Auth API (limited functionality in REPL)
    auth: {
      // Get user by ID
      getUserById: async (userId) => {
        if (supabaseKey !== env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Auth admin APIs can only be accessed with a service role key.');
        }
        
        const response = await fetchWithAuth(`/auth/v1/admin/users/${userId}`, {
          method: 'GET'
        });
        
        return await response.json();
      },
      
      // List users
      listUsers: async (options = {}) => {
        if (supabaseKey !== env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Auth admin APIs can only be accessed with a service role key.');
        }
        
        const { page = 1, perPage = 50 } = options;
        const response = await fetchWithAuth(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
          method: 'GET'
        });
        
        return await response.json();
      }
    }
  };
}

// Create default client using environment variables
try {
  const supabase = createSupabaseClient();
  console.log('✅ Supabase client initialized successfully');
  
  // Export both the factory and the default client
  module.exports = {
    createSupabaseClient,
    supabase
  };
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error.message);
  
  // Export just the factory if we couldn't create the default client
  module.exports = {
    createSupabaseClient
  };
} 