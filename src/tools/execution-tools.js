

import { TOOL_STRINGS } from '../constants/tool-strings.js';
import {
  toolCreators,
  responseFormatters,
  DEFAULT_PARAMS,
  COMMON_SCHEMAS
} from '../utils/shared-hooks.js';

export const executionTools = [
  toolCreators.withWorkingDirectory(
    "execute",
    TOOL_STRINGS.EXECUTE_DESCRIPTION,
    async ({ code, commands, workingDirectory, runtime = DEFAULT_PARAMS.runtime, timeout = DEFAULT_PARAMS.timeout }) => {
      return responseFormatters.execution(workingDirectory, runtime);
    },
    {
      code: COMMON_SCHEMAS.code,
      commands: COMMON_SCHEMAS.commands,
      runtime: COMMON_SCHEMAS.runtime,
      timeout: COMMON_SCHEMAS.timeout,
      }
  ),

  toolCreators.withWorkingDirectory(
    "retrieve_overflow",
    "Retrieve truncated content from previous tool calls",
    async ({ workingDirectory, overflowFile, chunkIndex = DEFAULT_PARAMS.chunkIndex, listFiles = DEFAULT_PARAMS.listFiles, cleanup = DEFAULT_PARAMS.cleanup }) => {
      return {
        content: [{ type: "text", text: `${TOOL_STRINGS.OVERFLOW_RETRIEVAL_REQUESTED} ${workingDirectory}` }],
        isError: false
      };
    },
    {
      overflowFile: {
        type: "string",
        description: TOOL_STRINGS.OVERFLOW_FILENAME_DESCRIPTION
      },
      chunkIndex: {
        type: "number",
        description: TOOL_STRINGS.CHUNK_INDEX_DESCRIPTION
      },
      listFiles: {
        type: "boolean",
        description: TOOL_STRINGS.LIST_FILES_DESCRIPTION
      },
      cleanup: {
        type: "boolean",
        description: TOOL_STRINGS.CLEANUP_DESCRIPTION
      }
    }
  )
];