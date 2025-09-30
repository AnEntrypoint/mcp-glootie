import { getAllCaveats, addCaveat, deleteCaveat, deleteCaveatByText } from '../core/caveat-manager.js';
import { workingDirectoryContext, createToolContext } from '../core/working-directory-context.js';
import { addExecutionStatusToResponse } from '../core/execution-state.js';
import { ToolError } from '../core/error-handling.js';
import { withConnectionManagement } from '../core/connection-manager.js';
import { withCrossToolAwareness } from '../core/cross-tool-context.js';

export const caveatTools = [
  {
    name: "caveat",
    description: "Manage technological caveats/limitations discovered during development. Record constraints (rate limits, connection limits, known bugs), view all caveats, or delete resolved ones. Caveats persist across sessions and display at MCP initialization. Examples: 'API has 100 req/min limit', 'DB pool limited to 10 connections', 'Library v2.1 has memory leak'.",
    inputSchema: {
      type: "object",
      properties: {
        workingDirectory: {
          type: "string",
          description: "Working directory path"
        },
        action: {
          type: "string",
          enum: ["record", "view", "delete"],
          description: "Action to perform: record a new caveat, view existing caveats, or delete a caveat"
        },
        text: {
          type: "string",
          description: "Caveat text (required for 'record' action, should be double line separated from other caveats)"
        },
        id: {
          type: "string",
          description: "Caveat ID or text (required for 'delete' action)"
        }
      },
      required: ["workingDirectory", "action"]
    },
    handler: withCrossToolAwareness(withConnectionManagement(async ({ workingDirectory, action, text, id }) => {
      try {
        if (!workingDirectory) {
          throw new ToolError(
            'Working directory is required',
            'MISSING_PARAMETER',
            'caveat',
            false,
            ['Provide absolute path to working directory']
          );
        }

        if (!action || !['record', 'view', 'delete'].includes(action)) {
          throw new ToolError(
            'Action must be one of: record, view, delete',
            'INVALID_PARAMETER',
            'caveat',
            false,
            ['Specify a valid action: record, view, or delete']
          );
        }

        let result;

        switch (action) {
          case 'record':
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
              throw new ToolError(
                'Caveat text is required for record action',
                'MISSING_PARAMETER',
                'caveat',
                false,
                ['Provide the caveat text to record']
              );
            }

            const newCaveat = addCaveat(text);
            result = {
              success: true,
              message: `Caveat recorded successfully (ID: ${newCaveat.id})`,
              caveat: newCaveat
            };
            break;

          case 'view':
            const caveats = getAllCaveats();
            result = {
              success: true,
              caveats: caveats,
              count: caveats.length
            };
            break;

          case 'delete':
            if (!id) {
              throw new ToolError(
                'Caveat ID is required for delete action',
                'MISSING_PARAMETER',
                'caveat',
                false,
                ['Provide the ID of the caveat to delete']
              );
            }

            try {
              deleteCaveat(id);
              result = {
                success: true,
                message: `Caveat ${id} deleted successfully`
              };
            } catch (idError) {
              try {
                deleteCaveatByText(id);
                result = {
                  success: true,
                  message: `Caveat matching '${id}' deleted successfully`
                };
              } catch (textError) {
                throw new ToolError(
                  `Caveat not found by ID or text: '${id}'`,
                  'NOT_FOUND',
                  'caveat',
                  false,
                  ['Check the caveat text or use view to see all caveats']
                );
              }
            }
            break;
        }

        const toolContext = createToolContext('caveat', workingDirectory, action, {
          ...result,
          action,
          duration: 0
        });

        await workingDirectoryContext.updateContext(workingDirectory, 'caveat', toolContext);

        return addExecutionStatusToResponse({
          content: [{ type: "text", text: formatCaveatResponse(result) }]
        }, 'caveat');

      } catch (error) {
        if (error instanceof ToolError) {
          return {
            content: [{ type: "text", text: `Caveat Error: ${error.message}` }],
            isError: true
          };
        }

        return {
          content: [{ type: "text", text: `Caveat Error: ${error.message}` }],
          isError: true
        };
      }
    }, 'caveat', {
      maxRetries: 2,
      retryDelay: 1000
    }), 'caveat')
  }
];

function formatCaveatResponse(result) {
  if (!result.success) {
    return `Error: ${result.message || 'Unknown error'}`;
  }

  switch (result.action || result.caveats ? 'view' : 'unknown') {
    case 'record':
      return `✅ Caveat recorded (ID: ${result.caveat.id})\n\n"${result.caveat.text}"`;

    case 'view':
      if (result.count === 0) {
        return 'No caveats recorded yet.';
      }

      let output = `Recorded caveats (${result.count}):\n\n`;
      result.caveats.forEach((caveat, index) => {
        output += `${index + 1}. [ID: ${caveat.id}] ${caveat.text}\n   Recorded: ${new Date(caveat.timestamp).toLocaleDateString()}\n\n`;
      });
      return output.trim();

    case 'delete':
      return result.message;

    default:
      return 'Caveat operation completed successfully';
  }
}