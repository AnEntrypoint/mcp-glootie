#!/usr/bin/env node
// ARM64-compatible vector search using transformers.js

import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';

// Configuration constants
const INDEX_DIR = './code_search_index';
const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_DIM = 384; // Dimension size for the chosen model
const DEFAULT_EXTS = ['js', 'ts'];
const DEFAULT_IGNORES = [
  'node_modules', '.git', '.node_modules', 
  'dist', 'build', 'coverage', '.nyc_output',
  'tmp', 'temp', '.tmp', '.cache', '.parcel-cache',
  '.next', '.nuxt', '.vuepress', '.docusaurus',
  'public', 'static', 'assets', 'images', 'img',
  '.vscode', '.idea', '.DS_Store', 'Thumbs.db',
  'out', 'output', 'generated', 'gen',
  '.angular', '.react', '.svelte-kit',
  'storybook-static', 'docs-build', 'build-docs',
  '.vite', '.turbo', '.nx', '.swc',
  'bower_components', 'jspm_packages', '.pnp',
  '__tests__', '__mocks__', '__snapshots__',
  '.jest', '.mocha', '.cypress', '.playwright',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.npmrc', '.yarnrc', '.pnpmrc'
];

const INDEX_FILE = 'code_index.json';
const VECTOR_INDEX_FILE = 'vector_index.json';

// Global state
let codeChunks = [];
let embeddingExtractor = null;
let isInitialized = false;

// Load ignore patterns from .gitignore files
async function loadGitignorePatterns(rootDir, ignoreFiles = ['.gitignore']) {
  const patterns = [...DEFAULT_IGNORES];
  
  for (const ignoreFile of ignoreFiles) {
    const ignorePath = path.join(rootDir, ignoreFile);
    
    if (existsSync(ignorePath)) {
      try {
        const content = readFileSync(ignorePath, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            patterns.push(trimmedLine);
          }
        }
      } catch (error) {
        // Silently handle ignore file parse errors
      }
    }
  }
  
  return patterns;
}

// Check if a path should be ignored
function shouldIgnorePath(filePath, ignorePatterns, rootDir) {
  const normalizedPath = path.relative(rootDir, filePath);
  const standardPath = normalizedPath.replace(/\\/g, '/');
  
  for (const pattern of ignorePatterns) {
    if (standardPath === pattern || standardPath === pattern.replace(/\/$/, '')) {
      return true;
    }
    
    if (pattern.endsWith('/**') && standardPath.startsWith(pattern.slice(0, -2))) {
      return true;
    }
    
    if (pattern.startsWith('*.') && standardPath.endsWith(pattern.slice(1))) {
      return true;
    }
    
    if (pattern.endsWith('/') && standardPath.startsWith(pattern)) {
      return true;
    }
  }
  
  return false;
}

// Initialize the embedding model
export async function initialize(indexDir = INDEX_DIR) {
  if (isInitialized) return true;

  try {
    console.log('[DEBUG] Initializing ARM64-compatible vector search...');
    
    // Create index directory if it doesn't exist
    if (!existsSync(indexDir)) {
      mkdirSync(indexDir, { recursive: true });
    }

    // Initialize embedding extractor with ARM64-safe configuration
    if (!embeddingExtractor) {
      console.log('[DEBUG] Loading embedding model...');
      embeddingExtractor = await pipeline('feature-extraction', DEFAULT_MODEL, {
        device: 'wasm' // ARM64-safe configuration
      });
      console.log('[DEBUG] Embedding model loaded successfully');
    }

    isInitialized = true;
    console.log('[DEBUG] Vector search initialized successfully');
    return true;
  } catch (error) {
    console.error(`[DEBUG] Vector search initialization failed: ${error.message}`);
    return false;
  }
}

// Process code files into chunks
function processCodeIntoChunks(content, filePath) {
  const chunks = [];
  const lines = content.split('\n');
  
  // Split into logical chunks (functions, classes, blocks)
  let currentChunk = '';
  let inFunction = false;
  let inClass = false;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Start of function or class
    if (trimmedLine.match(/^(function|class)\s+\w/)) {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          file: filePath,
          startLine: Math.max(0, i - currentChunk.split('\n').length),
          endLine: i
        });
      }
      currentChunk = line;
      braceCount = (line.match(/{/g) || []).length;
      inFunction = trimmedLine.startsWith('function');
      inClass = trimmedLine.startsWith('class');
    } else {
      currentChunk += '\n' + line;
      
      // Track braces for proper chunking
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      // End chunk when brace count reaches zero
      if (braceCount === 0 && (inFunction || inClass)) {
        chunks.push({
          content: currentChunk.trim(),
          file: filePath,
          startLine: Math.max(0, i - currentChunk.split('\n').length),
          endLine: i
        });
        currentChunk = '';
        inFunction = false;
        inClass = false;
      }
    }
  }
  
  // Add remaining content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      file: filePath,
      startLine: Math.max(0, lines.length - currentChunk.split('\n').length),
      endLine: lines.length - 1
    });
  }
  
  return chunks;
}

// Synchronize the index with the file system
export async function syncIndex(folders, exts = DEFAULT_EXTS, ignores = DEFAULT_IGNORES) {
  if (!isInitialized) {
    await initialize();
  }
  
  const files = [];
  const ignorePatterns = await loadGitignorePatterns(process.cwd());
  
  for (const folder of folders) {
    await scanDirectory(folder, ignorePatterns, files, exts);
  }
  
  // Process files into chunks
  const newChunks = [];
  for (const file of files) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const chunks = processCodeIntoChunks(content, file);
      newChunks.push(...chunks);
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
  
  codeChunks = newChunks;
  console.log(`[DEBUG] Indexed ${codeChunks.length} code chunks`);
  
  // Save index
  const indexData = {
    timestamp: Date.now(),
    chunks: codeChunks.map(c => ({
      file: c.file,
      content: c.content,
      startLine: c.startLine,
      endLine: c.endLine
    }))
  };
  
  writeFileSync(path.join(INDEX_DIR, INDEX_FILE), JSON.stringify(indexData, null, 2));
  
  return codeChunks.length;
}

// Helper function to scan directories
async function scanDirectory(dir, ignorePatterns, files, exts) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!shouldIgnorePath(fullPath, ignorePatterns, process.cwd())) {
          await scanDirectory(fullPath, ignorePatterns, files, exts);
        }
      } else if (entry.isFile()) {
        const fileExt = path.extname(entry.name).slice(1);
        if (exts.includes(fileExt) && !shouldIgnorePath(fullPath, ignorePatterns, process.cwd())) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

// Query the index with semantic search
export async function queryIndex(query, topK = 8) {
  if (!isInitialized) {
    await initialize();
  }
  
  if (codeChunks.length === 0) {
    return [];
  }
  
  try {
    // Generate query embedding
    const queryEmbedding = await embeddingExtractor(query, { 
      pooling: 'mean', 
      normalize: true 
    });
    
    // Calculate similarity with all chunks
    const results = [];
    for (let i = 0; i < codeChunks.length; i++) {
      const chunk = codeChunks[i];
      try {
        const chunkEmbedding = await embeddingExtractor(chunk.content, { 
          pooling: 'mean', 
          normalize: true 
        });
        
        // Calculate cosine similarity
        const similarity = calculateCosineSimilarity(queryEmbedding.data, chunkEmbedding.data);
        
        results.push({
          file: chunk.file,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          similarity: similarity
        });
      } catch (error) {
        // Skip chunks that can't be embedded
      }
    }
    
    // Sort by similarity and return topK results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(r => ({
        file: r.file,
        content: r.content,
        startLine: r.startLine,
        endLine: r.endLine,
        score: r.similarity
      }));
    
  } catch (error) {
    console.error('[DEBUG] Query failed:', error);
    return [];
  }
}

// Calculate cosine similarity between two vectors
function calculateCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Search with enhanced natural language support
export async function searchCode(query, workingDirectory, folders = ['.'], extensions = DEFAULT_EXTS, topK = 8) {
  try {
    // Validate working directory
    if (!existsSync(workingDirectory)) {
      console.error(`Working directory does not exist: ${workingDirectory}`);
      return [];
    }

    // Initialize if needed
    const initPromise = isInitialized ? Promise.resolve() : initialize();
    await Promise.race([
      initPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), 10000))
    ]);

    // Convert folder paths to absolute paths
    const absFolders = folders.map(f => path.resolve(workingDirectory, f));
    
    // Sync index and get results
    await syncIndex(absFolders, extensions);
    return await queryIndex(query, topK);
    
  } catch (error) {
    console.error('[DEBUG] Search failed:', error);
    return [];
  }
}