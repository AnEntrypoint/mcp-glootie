/**
 * Test for the specific endpoint testing code that failed with object literals
 */

export default [
  {
    "name": "Return endpoint test results with object literal",
    "code": `// Test the URL and key validity to understand if there might be configuration issues
const fetchWithTimeout = async (url, options, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const testEndpoint = async (url, apiKey, description) => {
  console.log(\`Testing \${description} at \${url}...\`);
  
  try {
    const response = await fetchWithTimeout(url, {
      method: 'HEAD',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`
      }
    });
    
    console.log(\`\${description} Status: \${response.status} \${response.statusText}\`);
    return {
      url,
      status: response.status,
      success: response.ok,
      message: response.statusText
    };
  } catch (error) {
    console.error(\`Failed to connect to \${description}: \${error.message}\`);
    return {
      url,
      status: 'error',
      success: false,
      message: error.message
    };
  }
};

// Configuration 
const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_ROLE_KEY = "test-key";

// Mock endpoints to test without making real requests
const results = [
  { url: \`\${SUPABASE_URL}/functions/v1/tasks\`, status: 200, success: true, message: 'OK' },
  { url: \`\${SUPABASE_URL}/functions/v1/wrappedkeystore\`, status: 200, success: true, message: 'OK' },
  { url: \`\${SUPABASE_URL}/functions/v1/wrappedopenai\`, status: 200, success: true, message: 'OK' },
  { url: \`\${SUPABASE_URL}/functions/v1/wrappedwebsearch\`, status: 200, success: true, message: 'OK' },
  { url: \`\${SUPABASE_URL}/functions/v1/quickjs\`, status: 200, success: true, message: 'OK' }
];

// Format the output to identify the status of each service
const summary = results.reduce((acc, result) => {
  acc[result.url.split('/').pop()] = {
    success: result.success,
    status: result.status,
    message: result.message
  };
  return acc;
}, {});

// Overall assessment
const workingServices = results.filter(r => r.success).length;
const recommendation = workingServices === results.length 
  ? "All services appear to be working correctly."
  : \`\${results.length - workingServices} service(s) have issues and need attention.\`;

// Return results
{
  endpoints: summary,
  summary: {
    working: workingServices,
    total: results.length,
    recommendation
  }
}`,
    "expected": "{ endpoints: { tasks: [Object], wrappedkeystore: [Object], wrappedopenai: [Object], wrappedwebsearch: [Object], quickjs: [Object] }, summary: { working: 5, total: 5, recommendation: 'All services appear to be working correctly.' } }"
  }
]; 