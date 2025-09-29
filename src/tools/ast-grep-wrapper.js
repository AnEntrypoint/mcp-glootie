// Wrapper for @ast-grep/napi with graceful degradation on Windows
let astGrep = null;
let astGrepAvailable = false;

try {
  const module = await import('@ast-grep/napi');
  astGrep = module;
  astGrepAvailable = true;
} catch (error) {
  console.warn('⚠️  @ast-grep/napi native binding not available. AST features will be disabled.');
  console.warn('   This is expected on Windows due to optional dependency issues.');
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