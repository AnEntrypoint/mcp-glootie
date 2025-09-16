  if (!content || typeof content !== 'object') return content;
  
  const maxChars = maxTokens * CHARS_PER_TOKEN - TRUNCATION_BUFFER;
  
  if (Array.isArray(content)) return truncateArray(content, maxChars);
  if (content.text) return truncateSingle(content, maxChars);
  if (content.content?.length) return { ...content, content: truncateArray(content.content, maxChars) };
  
  return content;
}

function truncateArray(items, maxChars) {
  let totalChars = 0;
  const result = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.text) { result.push(item); continue; }
    
    const itemChars = item.text.length;
    if (totalChars + itemChars > maxChars) {
      const remaining = maxChars - totalChars;
      if (remaining > MIN_PARTIAL_CHARS) {
        result.push({ ...item, text: item.text.substring(0, remaining) + '\n\n[PARTIAL: Truncated]' });
      }
      
      const omitted = items.length - i - (remaining > MIN_PARTIAL_CHARS ? 0 : 1);
      if (omitted > 0) {
        const tokens = estimateRemainingTokens(items.slice(i + (remaining > MIN_PARTIAL_CHARS ? 1 : 0)));
        result.push({
          type: 'text',
          text: `\n[OUTPUT TRUNCATED: ${omitted} items omitted, ~${tokens} tokens, limit: ${MAX_TOKENS}]`
        });
      }
      break;
    }
    
    totalChars += itemChars;
    result.push(item);
  }
  return result;
}

function truncateSingle(content, maxChars) {
  if (content.text.length <= maxChars) return content;
  
  const truncated = content.text.substring(0, maxChars);
  const removed = content.text.length - maxChars;
  const tokens = estimateTokens(content.text.substring(maxChars));
  
  return {
    ...content,
    text: truncated + `\n\n[OUTPUT TRUNCATED: ${removed} chars, ~${tokens} tokens, limit: ${MAX_TOKENS}]`
  };
}

function estimateRemainingTokens(items) {
  const totalChars = items.reduce((sum, item) => sum + (item?.text?.length || 0), 0);
  return estimateTokens(totalChars.toString());
}