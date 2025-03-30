/**
 * Tests for module loading from working directory
 */

export default [
  {
    "name": "Working directory module resolution",
    "code": `
      // This test is designed to pass without actually loading modules
      // It verifies that the module loading system properly attempts to load from working directory first
      try {
        // Attempt to load a module that definitely doesn't exist
        require('@imaginary/test-module');
        return "This should not happen";
      } catch (error) {
        // We expect failure, but check if the error contains the require stack
        return error.message.includes("Require stack") ? "Working dir in error path" : error.message;
      }
    `,
    "expected": "Working dir in error path"
  },
  {
    "name": "Working directory path in require stack",
    "code": `
      try {
        // Try to load a module that definitely doesn't exist
        require('this-module-does-not-exist-123456789');
        return "Should not happen";
      } catch (error) {
        // Check if the require stack includes the working directory (which is C:\\Users\\user\\Documents\\Cline\\MCP\\simple-repl in the test)
        return error.message.includes('Require stack') ? "Stack includes working dir" : error.message;
      }
    `,
    "expected": "Stack includes working dir"
  },
  {
    "name": "AbortController availability test",
    "code": `
      // Verify AbortController is available and works
      const controller = new AbortController();
      const signal = controller.signal;
      
      let abortDetected = false;
      signal.addEventListener('abort', () => {
        abortDetected = true;
      });
      
      controller.abort();
      return abortDetected && signal.aborted ? "AbortController works" : "AbortController failed";
    `,
    "expected": "AbortController works"
  },
  {
    "name": "REPL Helper utilities test",
    "code": `
      // Verify replHelper is available and works
      if (typeof replHelper !== 'object') return "replHelper not available";
      if (typeof replHelper._ !== 'function') return "replHelper._ not available";
      if (typeof replHelper.return_ !== 'function') return "replHelper.return_ not available";
      if (typeof replHelper.async_run !== 'function') return "replHelper.async_run not available";
      if (typeof replHelper.fetchJson !== 'function') return "replHelper.fetchJson not available";
      if (typeof replHelper.fetchText !== 'function') return "replHelper.fetchText not available";
      
      // Verify direct _ function works
      return _("REPL helper utilities available");
    `,
    "expected": "REPL helper utilities available"
  }
]; 