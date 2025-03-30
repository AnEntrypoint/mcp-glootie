// Tests for fetch operations in the REPL environment

export default [
  {
    name: "Basic fetch availability",
    code: "typeof fetch === 'function';",
    expected: true
  },
  {
    name: "Fetch HTTP request",
    code: `async function testFetch() {
  try {
    const response = await fetch('https://httpbin.org/get');
    return {
      status: response.status,
      ok: response.ok,
      success: true
    };
  } catch (error) {
    return {
      error: error.message,
      success: false
    };
  }
}
await testFetch();`,
    expected: {
      status: 200,
      ok: true,
      success: true
    }
  },
  {
    name: "Fetch with custom headers",
    code: `async function testHeaders() {
  try {
    const response = await fetch('https://httpbin.org/headers', {
      headers: {
        'X-Test-Header': 'test-value',
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return {
      status: response.status,
      headers: data.headers,
      success: true
    };
  } catch (error) {
    return {
      error: error.message,
      success: false
    };
  }
}
await testHeaders();`,
    expected: "Response with status 200 and X-Test-Header present"
  },
  {
    name: "Fetch POST request with JSON body",
    code: `async function testPost() {
  try {
    const response = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'data', value: 123 })
    });
    const data = await response.json();
    return {
      status: response.status,
      method: data.method,
      json: data.json,
      success: true
    };
  } catch (error) {
    return {
      error: error.message,
      success: false
    };
  }
}
await testPost();`,
    expected: {
      status: 200,
      method: "POST",
      json: { test: 'data', value: 123 },
      success: true
    }
  },
  {
    name: "Fetch error handling",
    code: `async function testFetchError() {
  try {
    // This domain doesn't exist
    const response = await fetch('https://thisdoesnotexistatall123.example');
    return {
      status: response.status,
      success: true
    };
  } catch (error) {
    return {
      errorOccurred: true,
      message: error.message.includes('fetch')
    };
  }
}
await testFetchError();`,
    expected: {
      errorOccurred: true,
      message: true
    }
  },
  {
    name: "Fetch with AbortController",
    code: `async function testAbort() {
  try {
    const controller = new AbortController();
    const { signal } = controller;
    
    // Abort immediately
    controller.abort();
    
    const fetchPromise = fetch('https://httpbin.org/delay/3', { signal });
    await fetchPromise;
    
    return {
      success: false,
      message: "Fetch should have been aborted"
    };
  } catch (error) {
    return {
      aborted: error.name === 'AbortError' || error.message.includes('abort'),
      success: true
    };
  }
}
await testAbort();`,
    expected: {
      aborted: true,
      success: true
    }
  }
]; 