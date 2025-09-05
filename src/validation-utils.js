// Utility functions for validation and common operations
import * as path from 'node:path';
import { existsSync, statSync } from 'fs';

// Working directory validation and resolution function
export const validateWorkingDirectory = (workingDirectory, defaultWorkingDir) => {
  // Enforce that a workingDirectory must be provided per-call.
  // Do NOT silently fall back to a server-level default — that would violate
  // the requirement that each call explicitly supply its working directory.
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