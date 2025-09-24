import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
export function getDefaultIgnorePatterns() {
  return [
    'node_modulestest*.test.*',      
    '**/*.spec.*',      
    'results**', 
    'debug-*.cache.temptemptmpdocs*.md',          
    '**/*.txt',         
    
    '**/*.json',        
    '**/*.yaml',        
    '**/*.yml',         
    '**/*.toml',        
    '**/*.xml',         
    '**/*.csv',         
    '**/*.log',         
    
    '**/package.json',  
    '**/tsconfig.json', 
    '**/jest.config.*', 
    '**/webpack.config.*', 
    '**/vite.config.*', 
    '**/tailwind.config.*', 
    
    '.next*.min.*',       
    '**/bundle.*',      
    '**/*.map',         
    '**/*.bak',         
    '**/*.swp',         
    '**/*.swo',         
    
    '**/*.cjs',         
    '**/*.mjs',         
    
    '**/coverage',
  '**/.nyc_output',
  '**/reports',
  '**/.turbo',
  '**/.vercel',
  '**/.netlify',
  '**/migrations',
  '**/seeds',
  '**/*.sql',
    '**/*.sqlite',
    '**/*.db',
    
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.svg',
    '**/*.ico',
    '**/*.pdf',
    '**/*.zip',
    '**/*.tar',
    '**/*.gz',
    '**/*.bin',
    
    '.DS_Store',
    'Thumbs.db',
    '.gitignore',
    '.gitattributes',
    
    'lib/**',           
    'bin/**',           
    'scripts/**',       
    'tools/**',         
  ];
}
export function createToolResponse(data, startTime, context = {}) {
  return {
    success: true,
    executionTimeMs: Date.now() - startTime,
    ...data,
    ...context
  };
}
export function createErrorResponse(error, startTime, context = {}) {
  return {
    success: false,
    error: error?.message || error || 'Unknown error occurred',
    executionTimeMs: Date.now() - startTime,
    ...context
  };
}
export function validateRequiredParams(args, requiredParams, startTime) {
  const missingParams = requiredParams.filter(param => !args[param]);
  if (missingParams.length > 0) {
    return createErrorResponse(
      new Error(`Missing required parameters: ${missingParams.join(', ')}`),
      startTime
    );
  }
  return null;
}
export function validateWorkingDirectory(workingDirectory, defaultWorkingDir) {
  if (!workingDirectory) {
    return {
      valid: false,
      error: 'workingDirectory parameter is required for this operation',
      effectiveDir: null
    };
  }
  try {
    const resolvedPath = resolve(workingDirectory);
    if (!existsSync(resolvedPath)) {
      return {
        valid: false,
        error: `Working directory '${workingDirectory}' does not exist`,
        effectiveDir: null
      };
    }
    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        valid: false,
        error: `Path '${workingDirectory}' is not a directory`,
        effectiveDir: null
      };
    }
    return {
      valid: true,
      effectiveDir: resolvedPath
    };
  } catch (error) {
    return {
      valid: false,
      error: `Error accessing working directory: ${error.message}`,
      effectiveDir: null
    };
  }
}