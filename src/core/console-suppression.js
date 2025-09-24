// Runtime console suppression helper for MCP tools - NOW DEFAULT
// This provides tools with access to the global console suppression state

export function shouldSuppressConsole() {
  return process.env.ENABLE_CONSOLE_OUTPUT !== 'true' || global.shouldSuppressConsole?.();
}

export function suppressConsoleOutput() {
  if (shouldSuppressConsole()) {
    // Override console methods at tool runtime
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};

    // Return original functions for restoration if needed
    return {
      restore: () => {
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
      }
    };
  }

  return { restore: () => {} };
}