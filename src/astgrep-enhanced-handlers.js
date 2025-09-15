// Enhanced AST-grep handlers
export const astgrepEnhancedHandlers = {
  handle: async (toolName, args) => {
    return { success: true, toolName, args };
  }
};

export default astgrepEnhancedHandlers;