export function shouldSuppressConsole() {
  return process.env.ENABLE_CONSOLE_OUTPUT !== 'true' || global.shouldSuppressConsole?.();
}
export function suppressConsoleOutput() {
  if (shouldSuppressConsole()) {
    
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    
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