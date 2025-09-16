
import * as path from 'node:path';
import { existsSync, statSync } from 'fs';

export const validateWorkingDirectory = (workingDirectory, defaultWorkingDir) => {

  if (!workingDirectory) {
    return {
      valid: false,
      error: 'workingDirectory parameter is required for this operation',
      effectiveDir: null
    };
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