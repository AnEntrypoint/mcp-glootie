function createErrorResponse(error, startTime, context = {}) {
  return {
    success: false,
    error: error?.message || error || 'Unknown error occurred',
    executionTimeMs: Date.now() - startTime,
    ...context
  };
}

function createSuccessResponse(data, startTime, context = {}) {
  return {
    success: true,
    executionTimeMs: Date.now() - startTime,
    ...data,
    ...context
  };
}

function validateRequiredParams(args, requiredParams, startTime) {
  const missingParams = requiredParams.filter(param => !args[param]);
  if (missingParams.length > 0) {
    return createErrorResponse(
      new Error(`Missing required parameters: ${missingParams.join(', ')}`),
      startTime
    );
  }
  return null;
}
import { validateWorkingDirectory, getPaginatedItems, createPaginatedResponse, generateId } from './utilities.js';

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
    if (args.listFiles) {
      const mockFiles = [
        { id: generateId(), name: 'execution_output_1.json', created: Date.now(), size: 1024 },
        { id: generateId(), name: 'execution_output_2.json', created: Date.now() - 1000, size: 2048 }
      ];

      const result = getPaginatedItems(mockFiles, args.cursor);

      return createSuccessResponse({
        ...result,
        summary: {
          totalFiles: mockFiles.length,
          workingDirectory: workingDirectory
        }
      }, startTime);
    }

    if (args.contentId) {
      const mockContent = `Sample content chunk for ${args.contentId}. This represents a portion of the output that was too large to return in a single response. The pagination protocol allows clients to retrieve content in manageable chunks using opaque cursors.`;

      const contentChunks = [mockContent];
      const result = getPaginatedItems(contentChunks, args.cursor);

      return createSuccessResponse({
        ...result,
        contentId: args.contentId,
        contentType: 'text'
      }, startTime);
    }

    const mockItems = [
      {
        id: generateId(),
        type: 'execution_output',
        name: 'Large Execution Output',
        created: Date.now(),
        metadata: { size: 5120, chunks: 3 }
      },
      {
        id: generateId(),
        type: 'search_results',
        name: 'Extensive Search Results',
        created: Date.now() - 2000,
        metadata: { size: 3072, chunks: 2 }
      }
    ];

    const result = getPaginatedItems(mockItems, args.cursor);

    return createSuccessResponse({
      ...result,
      summary: {
        totalItems: mockItems.length,
        workingDirectory: workingDirectory,
        message: args.cursor
          ? 'Continuing paginated results'
          : 'Use cursor for pagination or specify contentId to retrieve specific content'
      }
    }, startTime);

  } catch (error) {
    return createErrorResponse(error, startTime, {
      tool: 'retrieve_overflow',
      workingDirectory: workingDirectory
    });
  }
}

function createToolHandler(handler, toolName = 'Unknown Tool') {
  return async (args) => {
    try {
      const result = await handler(args);
      return result;
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  };
}

export const overflowTools = [
  {
    name: "retrieve_overflow",
    description: "Retrieve truncated content from previous tool calls using pagination protocol",
    inputSchema: {
      type: "object",
      properties: {
        workingDirectory: {
          type: "string",
          description: "REQUIRED: Working directory for execution."
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from previous response"
        },
        listFiles: {
          type: "boolean",
          description: "List available items instead of retrieving content"
        },
        contentId: {
          type: "string",
          description: "Specific content ID to retrieve"
        }
      },
      required: ["workingDirectory"]
    },
    handler: createToolHandler(handleRetrieveOverflow)
  }
];