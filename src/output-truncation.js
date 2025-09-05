// Enhanced output truncation utility for MCP tool responses
// Ensures responses stay within token limits while storing overflow in retrievable files

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import * as path from 'path';

const MAX_TOKENS = 25000;
const CHARS_PER_TOKEN = 4;
const TRUNCATION_BUFFER = 1000;
const MIN_PARTIAL_CHARS = 100;
const OVERFLOW_DIR = '.call_overflow';

export function estimateTokens(text) {
  return typeof text === 'string' ? Math.ceil(text.length / CHARS_PER_TOKEN) : 0;
}

/**
 * Create overflow directory in working directory if it doesn't exist
 */
function ensureOverflowDir(workingDirectory) {
  if (!workingDirectory) return null;
  
  const overflowPath = path.join(workingDirectory, OVERFLOW_DIR);
  if (!existsSync(overflowPath)) {
    mkdirSync(overflowPath, { recursive: true });
  }
  return overflowPath;
}

/**
 * Store overflow content in timestamped file
 */
function storeOverflow(overflowContent, workingDirectory, toolName = 'unknown') {
  if (!overflowContent || !workingDirectory) return null;
  
  const overflowDir = ensureOverflowDir(workingDirectory);
  if (!overflowDir) return null;
  
  const timestamp = Date.now();
  const filename = `overflow_${toolName}_${timestamp}.json`;
  const filepath = path.join(overflowDir, filename);
  
  const overflowData = {
    timestamp,
    toolName,
    totalChunks: Array.isArray(overflowContent) ? overflowContent.length : 1,
    chunks: Array.isArray(overflowContent) ? overflowContent : [overflowContent],
    estimatedTokens: Array.isArray(overflowContent) 
      ? overflowContent.reduce((sum, chunk) => sum + estimateTokens(JSON.stringify(chunk)), 0)
      : estimateTokens(JSON.stringify(overflowContent))
  };
  
  writeFileSync(filepath, JSON.stringify(overflowData, null, 2));
  return {
    overflowFile: filename,
    totalChunks: overflowData.totalChunks,
    estimatedTokens: overflowData.estimatedTokens
  };
}

/**
 * Enhanced truncation that stores overflow content
 */
export function truncateWithOverflow(content, workingDirectory, toolName = 'unknown', maxTokens = MAX_TOKENS) {
  if (!content || typeof content !== 'object') return { content, overflow: null };
  
  const maxChars = maxTokens * CHARS_PER_TOKEN - TRUNCATION_BUFFER;
  
  if (Array.isArray(content)) {
    return truncateArrayWithOverflow(content, maxChars, workingDirectory, toolName);
  }
  
  if (content.text) {
    return truncateSingleWithOverflow(content, maxChars, workingDirectory, toolName);
  }
  
  if (content.content?.length) {
    const result = truncateArrayWithOverflow(content.content, maxChars, workingDirectory, toolName);
    return {
      content: { ...content, content: result.content },
      overflow: result.overflow
    };
  }
  
  return { content, overflow: null };
}

function truncateArrayWithOverflow(items, maxChars, workingDirectory, toolName) {
  let totalChars = 0;
  const result = [];
  const overflowItems = [];
  let truncatedInPlace = false;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.text) { 
      result.push(item); 
      continue; 
    }
    
    const itemChars = item.text.length;
    if (totalChars + itemChars > maxChars && !truncatedInPlace) {
      const remaining = maxChars - totalChars;
      
      if (remaining > MIN_PARTIAL_CHARS) {
        // Truncate current item and store remainder
        const truncatedText = item.text.substring(0, remaining);
        const overflowText = item.text.substring(remaining);
        
        result.push({ ...item, text: truncatedText });
        overflowItems.push({ ...item, text: overflowText });
        truncatedInPlace = true;
      } else {
        // Store entire current item in overflow
        overflowItems.push(item);
      }
      
      // Store all remaining items in overflow
      overflowItems.push(...items.slice(i + (truncatedInPlace ? 1 : 0)));
      break;
    }
    
    totalChars += itemChars;
    result.push(item);
  }
  
  let overflowInfo = null;
  if (overflowItems.length > 0) {
    overflowInfo = storeOverflow(overflowItems, workingDirectory, toolName);
    
    if (overflowInfo) {
      result.push({
        type: 'text',
        text: `\n\n[OUTPUT TRUNCATED: Response too large for single call]\n` +
              `• Showing first ~${MAX_TOKENS} tokens (${result.length - 1} items)\n` +
              `• ${overflowInfo.totalChunks} additional items stored (~${overflowInfo.estimatedTokens} tokens)\n` +
              `• Overflow file: ${overflowInfo.overflowFile}\n` +
              `• Use 'retrieve_overflow' tool with file: "${overflowInfo.overflowFile}" to get remaining content\n` +
              `• Working directory MUST be specified: "${workingDirectory}"`
      });
    }
  }
  
  return { content: result, overflow: overflowInfo };
}

function truncateSingleWithOverflow(content, maxChars, workingDirectory, toolName) {
  if (content.text.length <= maxChars) {
    return { content, overflow: null };
  }
  
  const truncated = content.text.substring(0, maxChars);
  const overflowText = content.text.substring(maxChars);
  
  const overflowContent = { ...content, text: overflowText };
  const overflowInfo = storeOverflow(overflowContent, workingDirectory, toolName);
  
  let truncationNotice = `\n\n[OUTPUT TRUNCATED: Response too large for single call]`;
  if (overflowInfo) {
    truncationNotice += `\n• Showing first ~${MAX_TOKENS} tokens\n` +
                       `• ${overflowText.length} additional chars stored (~${overflowInfo.estimatedTokens} tokens)\n` +
                       `• Overflow file: ${overflowInfo.overflowFile}\n` +
                       `• Use 'retrieve_overflow' tool with file: "${overflowInfo.overflowFile}" to get remaining content\n` +
                       `• Working directory MUST be specified: "${workingDirectory}"`;
  }
  
  return {
    content: { ...content, text: truncated + truncationNotice },
    overflow: overflowInfo
  };
}

/**
 * Apply enhanced truncation to MCP response
 */
export function applyTruncation(response, workingDirectory = null, toolName = 'unknown', maxTokens = MAX_TOKENS) {
  if (!response) return response;
  
  // If no working directory provided, fall back to basic truncation
  if (!workingDirectory) {
    return applyBasicTruncation(response, maxTokens);
  }
  
  if (response.content) {
    const result = truncateWithOverflow(response.content, workingDirectory, toolName, maxTokens);
    return { 
      ...response, 
      content: result.content,
      ...(result.overflow && { _overflow: result.overflow })
    };
  }
  
  const result = truncateWithOverflow(response, workingDirectory, toolName, maxTokens);
  return {
    ...result.content,
    ...(result.overflow && { _overflow: result.overflow })
  };
}

/**
 * Retrieve overflow content from stored file
 */
export function retrieveOverflow(overflowFile, workingDirectory, chunkIndex = 0) {
  if (!overflowFile || !workingDirectory) {
    throw new Error('Both overflowFile and workingDirectory are required');
  }
  
  const overflowPath = path.join(workingDirectory, OVERFLOW_DIR, overflowFile);
  
  if (!existsSync(overflowPath)) {
    throw new Error(`Overflow file not found: ${overflowFile}`);
  }
  
  const overflowData = JSON.parse(readFileSync(overflowPath, 'utf8'));
  
  if (chunkIndex >= overflowData.chunks.length) {
    throw new Error(`Chunk index ${chunkIndex} out of range. Total chunks: ${overflowData.chunks.length}`);
  }
  
  const chunk = overflowData.chunks[chunkIndex];
  const hasMore = chunkIndex < overflowData.chunks.length - 1;
  
  return {
    content: Array.isArray(chunk) ? chunk : [chunk],
    metadata: {
      file: overflowFile,
      chunkIndex,
      totalChunks: overflowData.totalChunks,
      hasMoreChunks: hasMore,
      timestamp: overflowData.timestamp,
      toolName: overflowData.toolName,
      estimatedTokens: estimateTokens(JSON.stringify(chunk))
    }
  };
}

/**
 * List available overflow files
 */
export function listOverflowFiles(workingDirectory) {
  if (!workingDirectory) {
    throw new Error('workingDirectory is required');
  }
  
  const overflowDir = path.join(workingDirectory, OVERFLOW_DIR);
  
  if (!existsSync(overflowDir)) {
    return [];
  }
  
  const files = readdirSync(overflowDir)
    .filter(file => file.startsWith('overflow_') && file.endsWith('.json'))
    .map(file => {
      const filepath = path.join(overflowDir, file);
      const stats = statSync(filepath);
      
      try {
        const data = JSON.parse(readFileSync(filepath, 'utf8'));
        return {
          file,
          timestamp: data.timestamp,
          toolName: data.toolName,
          totalChunks: data.totalChunks,
          estimatedTokens: data.estimatedTokens,
          created: stats.birthtime,
          size: stats.size
        };
      } catch (error) {
        return {
          file,
          error: `Failed to read file: ${error.message}`,
          created: stats.birthtime,
          size: stats.size
        };
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp);
  
  return files;
}

/**
 * Clean up old overflow files (older than 24 hours)
 */
export function cleanupOverflowFiles(workingDirectory, maxAgeHours = 24) {
  if (!workingDirectory) return 0;
  
  const overflowDir = path.join(workingDirectory, OVERFLOW_DIR);
  if (!existsSync(overflowDir)) return 0;
  
  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  let cleanedCount = 0;
  
  const files = readdirSync(overflowDir)
    .filter(file => file.startsWith('overflow_') && file.endsWith('.json'));
  
  for (const file of files) {
    const filepath = path.join(overflowDir, file);
    const stats = statSync(filepath);
    
    if (stats.birthtime.getTime() < cutoffTime) {
      try {
        unlinkSync(filepath);
        cleanedCount++;
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
  
  return cleanedCount;
}

/**
 * Fallback to basic truncation without overflow storage
 */
function applyBasicTruncation(response, maxTokens = MAX_TOKENS) {
  if (!response) return response;
  
  if (response.content) {
    return { ...response, content: truncateOutput(response.content, maxTokens) };
  }
  
  return truncateOutput(response, maxTokens);
}

// Legacy functions for backward compatibility
function truncateOutput(content, maxTokens = MAX_TOKENS) {
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