// Wrapper for @ast-grep/napi with graceful degradation on Windows
let astGrep = null;
let astGrepAvailable = false;

try {
  const module = await import('@ast-grep/napi');
  astGrep = module;
  astGrepAvailable = true;
} catch (error) {
  // Silently degrade - only log in development
  if (process.env.NODE_ENV === 'development') {
    console.error('⚠️  @ast-grep/napi native binding not available. AST features will be disabled.');
    console.error('   Try running: npm run postinstall');
  }
  astGrepAvailable = false;
}

export const parse = astGrepAvailable ? astGrep.parse : null;
export const isAstGrepAvailable = () => astGrepAvailable;

export function ensureAstGrepAvailable() {
  if (!astGrepAvailable) {
    throw new Error(
      'AST functionality is not available on this system. ' +
      'The @ast-grep/napi native binding could not be loaded. ' +
      'This feature requires native bindings that may not be available on all platforms.'
    );
  }
}