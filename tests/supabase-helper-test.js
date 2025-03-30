// Tests for Supabase helper functionality

export default [
  {
    name: "Basic fetch works",
    code: `
      const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      const data = await response.json();
      return data.title ? "Fetch works" : "Failed";
    `,
    expected: "Fetch works"
  },
  {
    name: "Fetch with timeout works",
    code: `
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('https://jsonplaceholder.typicode.com/todos/1', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.title ? "Fetch with timeout works" : "Failed";
      } catch (e) {
        clearTimeout(timeoutId);
        return e.name === 'AbortError' ? 'Aborted' : 'Error: ' + e.message;
      }
    `,
    expected: "Fetch with timeout works"
  },
  {
    name: "AbortController works",
    code: `
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10);
      
      try {
        await fetch('https://httpstat.us/200?sleep=2000', { 
          signal: controller.signal 
        });
        return "Should have been aborted";
      } catch (error) {
        return error.name === 'AbortError' ? "AbortController works" : "Wrong error: " + error.message;
      }
    `,
    expected: "AbortController works"
  },
  {
    name: "Global fetch is available",
    code: `
      return typeof fetch === 'function' ? "fetch is available" : "fetch is not available";
    `,
    expected: "fetch is available"
  },
  {
    name: "Global AbortController is available",
    code: `
      return typeof AbortController === 'function' ? "AbortController is available" : "AbortController is not available";
    `,
    expected: "AbortController is available"
  },
  {
    name: "Environment variables accessible",
    code: `
      // Just check that env exists, not actual values since they depend on setup
      return typeof env === 'object' ? "env is available" : "env is not available";
    `,
    expected: "env is available"
  },
  {
    name: "Can handle fetch errors gracefully",
    code: `
      try {
        // Use a non-existent domain to force a DNS error
        await fetch('https://this-domain-does-not-exist-abc123xyz.example');
        return "Should have failed";
      } catch (error) {
        return "Error handled: " + (error.code || error.name || "unknown error");
      }
    `,
    expected: match => match.startsWith("Error handled:")
  },
  {
    name: "urlUtils is available",
    code: `
      if (typeof urlUtils !== 'object') return "urlUtils is not available";
      if (typeof urlUtils.normalizeUrl !== 'function') return "normalizeUrl is not available";
      if (typeof urlUtils.isValidUrl !== 'function') return "isValidUrl is not available";
      return "urlUtils is available";
    `,
    expected: "urlUtils is available"
  }
]; 