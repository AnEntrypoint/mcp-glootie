// MCP handler for sequential thinking tool - KISS principle under 110 lines
import { SequentialThinkingEngine } from './sequential-thinking-engine.js';
import { validateWorkingDirectory } from './validation-utils.js';

export const handleSequentialThinking = async (args, serverWorkingDir) => {
  const startTime = Date.now();
  
  try {
    const { thoughts, workingDirectory, parentId } = args;
    
    if (!workingDirectory) {
      return {
        content: [
          { type: 'text', text: '**WORKING DIRECTORY REQUIRED**' },
          { type: 'text', text: 'The sequential thinking tool needs a workingDirectory parameter to store thought data locally.' },
          { type: 'text', text: '' },
          { type: 'text', text: 'Please provide the workingDirectory parameter:' },
          { type: 'text', text: '• Example: { "workingDirectory": "/path/to/your/project" }' },
          { type: 'text', text: '• This creates .sequential-thoughts/ subdirectory for JSON data storage' },
          { type: 'text', text: '• Required for local data persistence and thought chain tracking' }
        ]
      };
    }
    
    const dirValidation = validateWorkingDirectory(workingDirectory, serverWorkingDir);
    if (!dirValidation.valid) throw new Error(`Invalid working directory: ${dirValidation.error}`);
    
    if (!thoughts) throw new Error('Thoughts parameter is required');
    
    const thinkingEngine = new SequentialThinkingEngine(dirValidation.effectiveDir);
    const result = await thinkingEngine.processThoughts(thoughts, parentId, args.taskContext || {});
    const totalExecutionTime = Date.now() - startTime;
    
    const outputLines = [];
    outputLines.push({
      type: 'text',
      text: `Sequential Thinking Processed - ${result.processedCount} thought${result.processedCount !== 1 ? 's' : ''}`
    });
    outputLines.push({ type: 'text', text: `Working Directory: ${dirValidation.effectiveDir}` });
    outputLines.push({ type: 'text', text: `Data Storage: ${result.storageLocation}` });
    
    result.thoughts.forEach((thought, index) => {
      const summary = [
        `${index + 1}. [${thought.id}] ${thought.content.substring(0, 80)}${thought.content.length > 80 ? '...' : ''}`,
        `   Timestamp: ${thought.timestamp}`,
        `   Branch: ${thought.metadata.branchId}`,
        `   Depth: ${thought.metadata.depth}`,
        `   Length: ${thought.metadata.contentLength} characters`
      ];
      if (thought.parentId) summary.push(`   Parent: ${thought.parentId}`);
      if (result.optimizationsApplied) summary.push(`   Optimized: Yes`);
      outputLines.push({ type: 'text', text: summary.join('\n') });
    });
    
    outputLines.push({
      type: 'text',
      text: `Processing completed in ${totalExecutionTime}ms (Engine: ${result.executionTimeMs}ms)`
    });
    
    return { content: outputLines };
    
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `Sequential Thinking Error: ${error.message}` },
        { type: 'text', text: `Error occurred after ${Date.now() - startTime}ms` }
      ]
    };
  }
};

export const getSequentialThinkingToolDefinition = () => {
  return {
    name: 'sequentialthinking',
    description: `**SEQUENTIAL THINKING ENGINE** - Always use this tool, no exceptions. Process and store sequential thoughts with mandatory local data persistence.

**CRITICAL USAGE REQUIREMENT**: Always use this tool for all thinking processes, no exceptions.

**BATCHING SUPPORT**: Process multiple sequential thoughts in single operation for maximum efficiency.
• Single thought: pass string directly
• Multiple thoughts: pass array of strings
• All thoughts processed atomically with consistent metadata

**LOCAL DATA PERSISTENCE**: 
• Stores data in {workingDirectory}/.sequential-thoughts/ (thoughts.json, branches.json, history.json)

**HIERARCHICAL THINKING SUPPORT**:
• Use parentId to create thought chains and branches
• Automatic depth tracking and branch management
• Complete thought genealogy preserved in local storage

**OUTPUT FEATURES**:
• Comprehensive thought metadata
• Storage location confirmation
• Processing performance metrics
• Thought relationship mapping

**ALWAYS USE INSTRUCTION**: Use this tool for all thinking processes, no exceptions.

**🚨 WORKING DIRECTORY REQUIRED 🚨**
• **MANDATORY PARAMETER**: workingDirectory must be specified for ALL operations
• **EXAMPLE**: { "workingDirectory": "/path/to/your/project" }
• **PURPOSE**: Defines the exact directory scope for the operation
• **CRITICAL**: Operations will fail or provide unhelpful guidance without this parameter

**AUTOMATIC RESPONSE TRUNCATION & OVERFLOW HANDLING:**
• **25k Token Limit**: Responses exceeding ~25,000 tokens are automatically truncated
• **Overflow Storage**: Excess content stored in \`.call_overflow/\` directory within workingDirectory
• **Seamless Retrieval**: Use \`retrieve_overflow\` tool to access stored content chunks
• **Preservation Guarantee**: Leading content always preserved, nothing lost permanently
• **Clear Instructions**: Truncation notices provide exact steps to retrieve remaining content`,
    inputSchema: {
      type: 'object',
      properties: {
        thoughts: {
          type: ['string', 'array'],
          description: 'Single thought (string) or multiple thoughts (array of strings) to process',
          items: { type: 'string', minLength: 1 },
          minLength: 1
        },
        workingDirectory: {
          type: 'string',
          description: 'Required: Working directory for storing thought data locally'
        },
        parentId: {
          type: 'string',
          description: 'Optional: Parent thought ID for creating thought chains'
        }
      },
      required: ['thoughts', 'workingDirectory']
    }
  };
};