// AST-grep JSON format utilities
export const astgrepJsonFormats = {
  compact: (data) => JSON.stringify(data),
  pretty: (data) => JSON.stringify(data, null, 2),
  stream: (data) => JSON.stringify(data) + '\n'
};

export default astgrepJsonFormats;