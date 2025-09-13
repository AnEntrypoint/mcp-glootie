// AST-grep test validation utilities
export const astgrepTestValidation = {
  test: async (rules, testCases, options = {}) => {
    return { results: [], rules, testCases, options };
  },

  validate: async (rules, options = {}) => {
    return { valid: true, rules, options };
  }
};

export default astgrepTestValidation;