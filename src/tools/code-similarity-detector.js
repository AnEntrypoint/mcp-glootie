#!/usr/bin/env node

import { createFileFilter } from '../core/ignore-manager.js';
import { existsSync, readFileSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { performance } from 'perf_hooks';

const SIMILARITY_THRESHOLD = 0.7; // Minimum similarity score to report
const MIN_LINES_FOR_COMPARISON = 5; // Minimum line count to consider for similarity
const MAX_CHUNKS_TO_COMPARE = 1000; // Performance limit
const LINE_SIMILARITY_THRESHOLD = 0.8; // How many lines must be similar overall
const TOP_SIMILARITY_THRESHOLD = 0.85; // Show only the most similar patterns
const MAX_SIMILAR_RESULTS = 5; // Show maximum of 5 most similar patterns

export class CodeSimilarityDetector {
  constructor(workingDirectory, options = {}) {
    this.workingDirectory = workingDirectory;
    this.options = {
      threshold: options.threshold || SIMILARITY_THRESHOLD,
      minLines: options.minLines || MIN_LINES_FOR_COMPARISON,
      maxChunks: options.maxChunks || MAX_CHUNKS_TO_COMPARE,
      ...options
    };

    // Create file filter using the same ignore patterns as search/AST tools
    this.fileFilter = createFileFilter(workingDirectory, [], {
      useGitignore: true,
      useDefaults: true
    });
  }

  async detectSimilarCode() {
    const startTime = performance.now();

    try {
      // Find all source code files
      const codeFiles = await this.findCodeFiles();

      // Extract code chunks from files
      const chunks = await this.extractCodeChunks(codeFiles);

      if (chunks.length < 2) {
        return {
          similarities: [],
          summary: {
            filesProcessed: codeFiles.length,
            chunksAnalyzed: chunks.length,
            similarPairsFound: 0,
            processingTime: Math.round(performance.now() - startTime)
          }
        };
      }

      // Find similarities between chunks
      const similarities = await this.findSimilarities(chunks);

      return {
        similarities: similarities.sort((a, b) => b.similarity - a.similarity),
        summary: {
          filesProcessed: codeFiles.length,
          chunksAnalyzed: chunks.length,
          similarPairsFound: similarities.length,
          processingTime: Math.round(performance.now() - startTime)
        }
      };
    } catch (error) {
      console.error('Error in code similarity detection:', error);
      return {
        similarities: [],
        summary: {
          filesProcessed: 0,
          chunksAnalyzed: 0,
          similarPairsFound: 0,
          processingTime: Math.round(performance.now() - startTime),
          error: error.message
        }
      };
    }
  }

  async findCodeFiles() {
    const { readdirSync, statSync } = await import('fs');
    const files = [];

    const scanDirectory = (dir) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip directories that should be ignored
            if (!this.fileFilter.ignores(fullPath)) {
              scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            // Check if file should be processed
            if (this.fileFilter.shouldProcess(fullPath)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Ignore permission errors and other filesystem issues
        if (error.code !== 'ENOENT' && error.code !== 'EACCES') {
          console.warn(`Warning: Could not scan directory ${dir}: ${error.message}`);
        }
      }
    };

    scanDirectory(this.workingDirectory);
    return files;
  }

  async extractCodeChunks(files) {
    const chunks = [];
    let chunkId = 0;

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const relativePath = relative(this.workingDirectory, filePath);

        // Extract chunks of contiguous code
        let currentChunk = {
          id: chunkId++,
          file: relativePath,
          startLine: 0,
          lines: [],
          originalLines: []
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Skip empty lines and comments for chunk boundaries
          if (line && !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('/*') && !line.startsWith('*')) {
            currentChunk.lines.push(line);
            currentChunk.originalLines.push(lines[i]);
          } else if (currentChunk.lines.length >= this.options.minLines) {
            // Save completed chunk
            currentChunk.endLine = i - 1;
            chunks.push(currentChunk);

            // Start new chunk
            currentChunk = {
              id: chunkId++,
              file: relativePath,
              startLine: i + 1,
              lines: [],
              originalLines: []
            };
          }
        }

        // Save final chunk if it meets minimum line requirement
        if (currentChunk.lines.length >= this.options.minLines) {
          currentChunk.endLine = lines.length - 1;
          chunks.push(currentChunk);
        }

      } catch (error) {
        console.warn(`Warning: Could not process file ${filePath}: ${error.message}`);
      }
    }

    return chunks.slice(0, this.options.maxChunks); // Limit for performance
  }

  async findSimilarities(chunks) {
    const similarities = [];

    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const chunk1 = chunks[i];
        const chunk2 = chunks[j];

        // Skip chunks from the same file (optional, remove if you want intra-file similarities)
        if (chunk1.file === chunk2.file) {
          continue;
        }

        const similarity = this.calculateSimilarity(chunk1.lines, chunk2.lines);

        if (similarity >= this.options.threshold) {
          similarities.push({
            similarity: Math.round(similarity * 100) / 100,
            chunk1: {
              file: chunk1.file,
              startLine: chunk1.startLine,
              endLine: chunk1.endLine,
              lineCount: chunk1.lines.length
            },
            chunk2: {
              file: chunk2.file,
              startLine: chunk2.startLine,
              endLine: chunk2.endLine,
              lineCount: chunk2.lines.length
            },
            sampleCode1: chunk1.originalLines.slice(0, 3).join('\n'),
            sampleCode2: chunk2.originalLines.slice(0, 3).join('\n')
          });
        }
      }
    }

    // Filter to show only the most similar patterns
    const filteredSimilarities = similarities.filter(sim => sim.similarity >= TOP_SIMILARITY_THRESHOLD);

    // Sort by similarity (highest first) and limit to top results
    return filteredSimilarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_SIMILAR_RESULTS);
  }

  calculateSimilarity(lines1, lines2) {
    if (lines1.length === 0 || lines2.length === 0) {
      return 0;
    }

    // Normalize lines by removing whitespace and converting to lowercase
    const normalizeLine = (line) => line.trim().toLowerCase();

    const normalized1 = lines1.map(normalizeLine);
    const normalized2 = lines2.map(normalizeLine);

    // Calculate line-level similarities
    let similarLines = 0;
    let totalComparisons = 0;

    for (let i = 0; i < Math.min(normalized1.length, normalized2.length); i++) {
      if (this.calculateLineSimilarity(normalized1[i], normalized2[i]) >= LINE_SIMILARITY_THRESHOLD) {
        similarLines++;
      }
      totalComparisons++;
    }

    // Account for length difference penalty
    const lengthRatio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);

    if (totalComparisons === 0) {
      return 0;
    }

    return (similarLines / totalComparisons) * lengthRatio;
  }

  calculateLineSimilarity(line1, line2) {
    if (line1 === line2) {
      return 1.0;
    }

    // Simple character-level similarity for lines
    const longer = line1.length > line2.length ? line1 : line2;
    const shorter = line1.length > line2.length ? line2 : line1;

    if (shorter.length === 0) {
      return 0;
    }

    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (shorter[i] === longer[i]) {
        matches++;
      }
    }

    return matches / longer.length;
  }
}

export async function detectCodeSimilarity(workingDirectory, options = {}) {
  const detector = new CodeSimilarityDetector(workingDirectory, options);
  return await detector.detectSimilarCode();
}

export function formatSimilarityOutput(result) {
  let output = '\n\n=== CODE SIMILARITY ANALYSIS ===\n';

  if (result.summary.error) {
    output += `❌ Error: ${result.summary.error}\n`;
    return output;
  }

  output += `📊 Analysis Summary:\n`;
  output += `   Files processed: ${result.summary.filesProcessed}\n`;
  output += `   Code chunks analyzed: ${result.summary.chunksAnalyzed}\n`;
  output += `   High-similarity patterns found: ${result.summary.similarPairsFound}\n`;
  output += `   Processing time: ${result.summary.processingTime}ms\n`;

  if (result.similarities.length === 0) {
    output += '\n✅ No high-similarity code patterns found (threshold: 85%).\n';
    return output;
  }

  output += `\n🔍 Top Similar Code Patterns (${result.similarities.length} most similar):\n`;
  output += '='.repeat(60) + '\n';

  result.similarities.forEach((similarity, index) => {
    output += `\n${index + 1}. ${(similarity.similarity * 100).toFixed(1)}% Similar\n`;
    output += `   📄 ${similarity.chunk1.file} (lines ${similarity.chunk1.startLine}-${similarity.chunk1.endLine})\n`;
    output += `   📄 ${similarity.chunk2.file} (lines ${similarity.chunk2.startLine}-${similarity.chunk2.endLine})\n`;
    output += `   💡 Code sample from file 1:\n`;
    output += `   ${similarity.sampleCode1.replace(/\n/g, '\n   ')}\n`;
    output += `   💡 Code sample from file 2:\n`;
    output += `   ${similarity.sampleCode2.replace(/\n/g, '\n   ')}\n`;
    output += `   ${'-'.repeat(40)}\n`;
  });

  return output;
}

export default {
  CodeSimilarityDetector,
  detectCodeSimilarity,
  formatSimilarityOutput
};