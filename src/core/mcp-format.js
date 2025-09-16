

export function convertToMCPFormat(response, toolName = 'unknown') {
  if (!response) {
    return { content: [{ type: 'text', text: 'No response' }] };
  }

  if (response.content && Array.isArray(response.content)) {
    return response;
  }

  const content = [];

  if (response.success) {
    
    if (response.stdout || response.stderr) {
      if (response.stdout) {
        content.push({
          type: 'text',
          text: response.stdout
        });
      }
      if (response.stderr && response.stderr.trim()) {
        content.push({
          type: 'text',
          text: `STDERR:\n${response.stderr}`
        });
      }

      if (response.code !== undefined) {
        const metadata = [`Exit code: ${response.code}`];
        if (response.executionTimeMs) {
          metadata.push(`Execution time: ${response.executionTimeMs}ms`);
        }
        content.push({
          type: 'text',
          text: `\n[${metadata.join(', ')}]`
        });
      }
    }
    
    else if (response.results) {
      content.push({
        type: 'text',
        text: JSON.stringify(response.results, null, 2)
      });
    }
    
    else {
      const responseText = Object.keys(response)
        .filter(key => !['success', 'executionTimeMs'].includes(key))
        .map(key => `${key}: ${JSON.stringify(response[key], null, 2)}`)
        .join('\n');
      
      if (responseText) {
        content.push({ type: 'text', text: responseText });
      } else {
        content.push({ type: 'text', text: 'Operation completed successfully' });
      }
    }
  }
  
  else {
    let errorText = response.error || 'Unknown error occurred';
    
    if (response.stdout) {
      errorText += `\n\nSTDOUT:\n${response.stdout}`;
    }
    if (response.stderr) {
      errorText += `\n\nSTDERR:\n${response.stderr}`;
    }
    
    content.push({
      type: 'text',
      text: errorText
    });
  }

  if (content.length === 0) {
    content.push({ type: 'text', text: 'No output' });
  }

  return { content };
}

export function formatAndTruncate(response, workingDirectory, toolName, applyTruncation) {
  const mcpResponse = convertToMCPFormat(response, toolName);
  return applyTruncation(mcpResponse, workingDirectory, toolName);
}