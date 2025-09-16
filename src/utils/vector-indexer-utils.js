import fs from 'fs';
import path from 'path';

const MAX_FILE_SIZE = 1024 * 1024;

export function processFile(file, codeChunks) {
  const newChunks = [];

  try {
    const stats = fs.statSync(file);
    if (stats.size > MAX_FILE_SIZE) {
      console.log(`File ${file} is large (${stats.size} bytes), truncating`);
      let content = fs.readFileSync(file, 'utf8');

      if (content.length > MAX_FILE_SIZE) {
        content = content.substring(0, MAX_FILE_SIZE);
      }

      const chunks = [{
        content,
        file,
        type: 'code',
        metadata: { truncated: true, originalSize: stats.size }
      }];
      newChunks.push(...chunks);
    }
  } catch (error) {
    console.error(`Error reading file ${file}:`, error);
  }

  codeChunks = newChunks;

  const indexData = {
    chunks: codeChunks,
    timestamp: Date.now(),
    version: '1.0'
  };

  return indexData;
}