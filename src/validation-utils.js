// Utility functions for validation and common operations
import * as path from 'node:path';
import { existsSync, statSync } from 'fs';

// Working directory validation and resolution function
export const validateWorkingDirectory = (workingDirectory, defaultWorkingDir) => {
  if (!workingDirectory) {
    return { valid: true, effectiveDir: defaultWorkingDir };
  }
  
  try {
    const resolvedPath = path.resolve(workingDirectory);
    
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
        error: `Working directory '${workingDirectory}' is not a directory`,
        effectiveDir: null
      };
    }
    
    return { valid: true, effectiveDir: resolvedPath };
  } catch (error) {
    return { 
      valid: false, 
      error: `Working directory '${workingDirectory}' is not accessible: ${error.message}`,
      effectiveDir: null
    };
  }
};