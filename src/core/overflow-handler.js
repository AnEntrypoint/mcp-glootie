

import { createErrorResponse, createSuccessResponse, validateRequiredParams } from './common-errors.js';
import { validateWorkingDirectory } from './validation-utils.js';
import { retrieveOverflow, listOverflowFiles, cleanupOverflowFiles } from './output-truncation.js';

export async function handleRetrieveOverflow(args, defaultWorkingDir) {
  const startTime = Date.now();
  
  const paramError = validateRequiredParams(args, ['workingDirectory'], startTime);
  if (paramError) return paramError;

  const dirValidation = validateWorkingDirectory(args.workingDirectory, defaultWorkingDir);
  if (!dirValidation.valid) {
    return createErrorResponse(dirValidation.error, startTime);
  }

  const workingDirectory = dirValidation.effectiveDir;

  try {
    let result = {};

    if (args.cleanup) {
      const cleanedCount = cleanupOverflowFiles(workingDirectory);
      result.cleanup = {
        filesRemoved: cleanedCount,
        message: `Cleaned up ${cleanedCount} old overflow files`
      };
    }

    if (args.listFiles) {
      const files = listOverflowFiles(workingDirectory);
      result.availableFiles = files;
      result.summary = {
        totalFiles: files.length,
        oldestFile: files.length > 0 ? files[files.length - 1].created : null,
        newestFile: files.length > 0 ? files[0].created : null,
        totalEstimatedTokens: files.reduce((sum, f) => sum + (f.estimatedTokens || 0), 0)
      };
      
      if (files.length === 0) {
        result.message = `No overflow files found in: ${workingDirectory}/.call_overflow/`;
      }
      
      return createSuccessResponse(result, startTime);
    }

    if (args.overflowFile) {
      const chunkIndex = args.chunkIndex || 0;
      const overflowResult = retrieveOverflow(args.overflowFile, workingDirectory, chunkIndex);
      
      result.content = overflowResult.content;
      result.metadata = overflowResult.metadata;

      if (overflowResult.metadata.hasMoreChunks) {
        result.nextChunk = {
          instructions: `To get the next chunk, call retrieve_overflow again with:`,
          parameters: {
            overflowFile: args.overflowFile,
            workingDirectory: workingDirectory,
            chunkIndex: chunkIndex + 1
          }
        };
      } else {
        result.message = "This is the final chunk of overflow content.";
      }
      
      return createSuccessResponse(result, startTime);
    }

    const files = listOverflowFiles(workingDirectory);
    result.availableFiles = files;
    result.summary = {
      totalFiles: files.length,
      message: files.length === 0 
        ? `No overflow files found in: ${workingDirectory}/.call_overflow/`
        : `Found ${files.length} overflow files. Specify 'overflowFile' parameter to retrieve content.`
    };
    
    if (files.length > 0) {
      result.instructions = {
        message: "To retrieve overflow content:",
        example: {
          overflowFile: files[0].file,
          workingDirectory: workingDirectory,
          chunkIndex: 0
        }
      };
    }

    return createSuccessResponse(result, startTime);

  } catch (error) {
    return createErrorResponse(error, startTime, { 
      tool: 'retrieve_overflow',
      workingDirectory: workingDirectory,
      overflowFile: args.overflowFile 
    });
  }
}