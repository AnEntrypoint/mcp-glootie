// AST-grep project configuration utilities
export const astgrepProjectConfig = {
  init: async (projectType, options = {}) => {
    return { success: true, projectType, options };
  },

  scan: async (scanType, options = {}) => {
    return { results: [], scanType, options };
  }
};

export default astgrepProjectConfig;