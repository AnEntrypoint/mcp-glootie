// Export the main executor function
export { executeCode } from './executor.js';

// Also export individual components for potential direct use
export { createExecutionContext } from './context-builder.js';
export { wrapCode } from './code-wrapper.js';
export { processVMResult } from './result-processor.js'; 