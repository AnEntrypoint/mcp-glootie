#!/usr/bin/env node
// Optimized vector search with memory management and performance improvements

import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';
import ignore from 'ignore';
import { getDefaultIgnorePatterns } from './utils/tool-utils.js';

// Platform detection and configuration
const platform = {
  arch: os.arch(),
  platform: os.platform(),
  isARM64: os.arch() === 'arm64',
  isX64: os.arch() === 'x64',
  isMacOS: os.platform() === 'darwin',
  isLinux: os.platform() === 'linux',
  isWindows: os.platform() === 'win32'
};

// Configuration constants with platform-specific optimizations
const INDEX_DIR = './code_search_index';
const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
const DEFAULT_DIM = 384; // Dimension size for the chosen model
const DEFAULT_EXTS = ['js', 'ts', 'jsx', 'tsx'];
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
  '.npmrc', '.yarnrc', '.pnpmrc',
  'test-*.js', 'test-*.ts', '*.test.js', '*.test.ts',
  '*.spec.js', '*.spec.ts', 'temp-*.js', 'ab-test-*.js',
  '*.min.js', '*.bundle.js', '*.chunk.js',
  '*.json', '*.md', '*.txt', '*.log', '*.xml', '*.csv',
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico',
  '*.pdf', '*.zip', '*.tar', '*.gz', '*.7z', '*.dmg',
  '*.exe', '*.dll', '*.so', '*.dylib',
  'coverage', 'reports', 'docs', 'documentation'
];

// File size limits (in bytes)
const MAX_FILE_SIZE = 1024 * 1024; // 1MB for regular files
const MAX_LARGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB for large files
const MAX_LINES_PER_CHUNK = 500; // Maximum lines per code chunk
const MAX_CACHE_SIZE = 1000; // Maximum number of cached embeddings

const INDEX_FILE = 'code_index.json';
const VECTOR_INDEX_FILE = 'vector_index.json';

// Platform-specific configuration
const platformConfig = {
  memoryLimit: platform.isARM64 ? 1024 * 1024 * 1024 : 512 * 1024 * 1024, // 1GB for ARM64, 512MB for others
  batchSize: platform.isARM64 ? 32 : 16, // Larger batch size for ARM64
  maxConcurrency: platform.isARM64 ? 4 : 2, // Higher concurrency for ARM64
  timeout: platform.isARM64 ? 60000 : 30000 // Longer timeout for ARM64
};

// Optimized global state with memory management
let codeChunks = [];
let embeddingExtractor = null;
let isInitialized = false;
let embeddingCache = new Map(); // Cache for embeddings to avoid recomputation
let indexTimestamp = 0; // Track when index was last updated

// LRU cache implementation for embeddings
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return null;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

const embeddingLRUCache = new LRUCache(MAX_CACHE_SIZE);

// Initialize transformers.js embedding provider (no fallbacks)
async function initializeEmbeddingProvider() {
  try {
    const { pipeline } = await import('@xenova/transformers');
    embeddingExtractor = await pipeline('feature-extraction', DEFAULT_MODEL);
    return true;
  } catch (error) {
    throw new Error(`Transformers.js initialization failed: ${error.message}`);
  }
}

// Create robust ignore filter using the ignore library
function createIgnoreFilter(rootDir) {
  const ig = ignore();

  // Get default ignore patterns with dynamic loading
  const defaultPatterns = getDefaultIgnorePatterns(rootDir);

  // Add default ignore patterns
  ig.add(DEFAULT_IGNORES);

  // Add any custom patterns from defaults
  if (defaultPatterns.customGitignore) {
    ig.add(defaultPatterns.customGitignore);
  }

  // Add file patterns from defaults
  if (defaultPatterns.files) {
    ig.add(defaultPatterns.files);
  }

  // Find and add all .gitignore files in the directory tree
  const addGitignoreFiles = (dir) => {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile() && entry.name === '.gitignore') {
          try {
            const content = readFileSync(fullPath, 'utf8');
            ig.add(content);
          } catch (error) {
            // Silently handle .gitignore read errors
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && !DEFAULT_IGNORES.includes(entry.name)) {
          // Recursively add .gitignore files from subdirectories
          addGitignoreFiles(fullPath);
        }
      }
    } catch (error) {
      // Silently handle directory read errors
    }
  };

  addGitignoreFiles(rootDir);
  return { ig, rootDir };
}

// Check if a file should be indexed based on extension
function shouldIndexFile(filePath, allowedExtensions) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    return false;
  }

  // Optimized file filtering with pre-compiled patterns
  const filename = path.basename(filePath);
  const excludedPatterns = [
    /\.min\.js$/, /\.bundle\.js$/, /\.pack\.js$/,
    /\.d\.ts$/, /\.d\.tsx$/,
    /\.map$/, /\.css\.map$/,
    /^package\.json$/, /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/,
    /^tsconfig\.json$/, /^jsconfig\.json$/,
    /\.eslintrc\..*$/, /\.prettierrc\..*$/,
    /^LICENSE.*$/, /^README.*$/, /^.*\.md$/, /^CHANGELOG.*$/,
    /^Dockerfile.*$/, /^docker-compose.*\.yml$/
  ];

  return !excludedPatterns.some(pattern => pattern.test(filename));
}

// Initialize the embedding model
export async function initialize(indexDir = INDEX_DIR) {
  if (isInitialized) return true;

  try {
    // Create index directory if it doesn't exist
    if (!existsSync(indexDir)) {
      mkdirSync(indexDir, { recursive: true });
    }

    // Initialize embedding extractor
    if (!embeddingExtractor) {
      await initializeEmbeddingProvider();
    }

    // Load existing index if available
    await loadIndex(indexDir);

    isInitialized = true;
    return true;
  } catch (error) {
    throw new Error(`Vector search initialization failed: ${error.message}`);
  }
}

// Load existing index with timestamp check
async function loadIndex(indexDir) {
  try {
    const indexPath = path.join(indexDir, INDEX_FILE);
    if (existsSync(indexPath)) {
      const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));
      codeChunks = indexData.chunks || [];
      indexTimestamp = indexData.timestamp || 0;
    }
  } catch (error) {
    // If loading fails, start fresh
    codeChunks = [];
    indexTimestamp = 0;
  }
}

// Process code files into chunks with improved chunking logic
function processCodeIntoChunks(content, filePath) {
  const chunks = [];
  const lines = content.split('\n');

  // Split into logical chunks (functions, classes, blocks)
  let currentChunk = '';
  let inFunction = false;
  let inClass = false;
  let braceCount = 0;
  let chunkLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Start of function or class
    if (trimmedLine.match(/^(function|class|const|let|var)\s+\w/)) {
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
      chunkLineCount = 1;
    } else {
      currentChunk += '\n' + line;
      chunkLineCount++;

      // Track braces for proper chunking
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // End chunk when brace count reaches zero or chunk gets too large
      if ((braceCount === 0 && (inFunction || inClass)) || chunkLineCount >= MAX_LINES_PER_CHUNK) {
        chunks.push({
          content: currentChunk.trim(),
          file: filePath,
          startLine: Math.max(0, i - currentChunk.split('\n').length),
          endLine: i
        });
        currentChunk = '';
        inFunction = false;
        inClass = false;
        chunkLineCount = 0;
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

// Synchronize the index with the file system (optimized with change detection)
export async function syncIndex(folders, exts = DEFAULT_EXTS, ignores = DEFAULT_IGNORES) {
  if (!isInitialized) {
    await initialize();
  }

  const files = [];
  const startTime = Date.now();

  // Check if we need to rebuild the index
  const lastModified = await getLastModifiedTime(folders);
  if (lastModified <= indexTimestamp && codeChunks.length > 0) {
    return codeChunks.length; // Index is up to date
  }

  for (const folder of folders) {
    const ignoreFilter = createIgnoreFilter(folder);
    await scanDirectory(folder, ignoreFilter, files, exts);
  }

  // Process files into chunks with memory management
  const newChunks = [];
  let skippedFiles = 0;

  for (const file of files) {
    try {
      const stats = await fs.stat(file);

      // Skip files that are too large
      if (stats.size > MAX_LARGE_FILE_SIZE) {
        skippedFiles++;
        continue;
      }

      // Skip large binary files by extension
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'].includes(ext)) {
        skippedFiles++;
        continue;
      }

      // For medium-sized files, truncate content
      let content = await fs.readFile(file, 'utf8');
      if (stats.size > MAX_FILE_SIZE) {
        content = content.substring(0, MAX_FILE_SIZE);
      }

      const chunks = processCodeIntoChunks(content, file);
      newChunks.push(...chunks);
    } catch (error) {
      // Skip files that can't be processed
    }
  }

  // Memory management: clear old cache if index is significantly different
  if (newChunks.length > codeChunks.length * 1.5 || newChunks.length < codeChunks.length * 0.5) {
    embeddingLRUCache.clear();
  }

  codeChunks = newChunks;
  indexTimestamp = startTime;

  // Save index
  const indexData = {
    timestamp: indexTimestamp,
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

// Get the last modified time of files in folders
async function getLastModifiedTime(folders) {
  let lastModified = 0;

  for (const folder of folders) {
    try {
      const files = await fs.readdir(folder, { withFileTypes: true });
      for (const file of files) {
        if (file.isFile()) {
          const fullPath = path.join(folder, file.name);
          const stats = await fs.stat(fullPath);
          lastModified = Math.max(lastModified, stats.mtimeMs);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  return lastModified;
}

// Helper function to scan directories with proper .gitignore support
async function scanDirectory(dir, ignoreFilter, files, exts) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(ignoreFilter.rootDir, fullPath);

      // Check if file/directory should be ignored using the ignore library
      if (ignoreFilter.ig.ignores(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(fullPath, ignoreFilter, files, exts);
      } else if (entry.isFile()) {
        // Check if this file should be indexed based on extension and content type
        if (shouldIndexFile(fullPath, exts)) {
          // Check file size - skip files larger than MAX_FILE_SIZE
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size <= MAX_FILE_SIZE) { // 1MB limit
              files.push(fullPath);
            }
          } catch (error) {
            // Skip files we can't stat
          }
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

// Optimized embedding extraction with caching
async function getEmbedding(text) {
  const cacheKey = text; // Use text as cache key

  // Check cache first
  const cached = embeddingLRUCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Generate embedding
  const embedding = await embeddingExtractor(text, {
    pooling: 'mean',
    normalize: true
  });

  // Cache the result
  embeddingLRUCache.set(cacheKey, embedding);

  return embedding;
}

// Query the index with semantic search (optimized with batching)
export async function queryIndex(query, topK = 8) {
  if (!isInitialized) {
    await initialize();
  }

  if (codeChunks.length === 0) {
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await getEmbedding(query);

  // Batch process chunks for better performance
  const results = [];
  const batchSize = platformConfig.batchSize;

  for (let i = 0; i < codeChunks.length; i += batchSize) {
    const batch = codeChunks.slice(i, i + batchSize);
    const batchPromises = batch.map(async (chunk) => {
      const chunkEmbedding = await getEmbedding(chunk.content);
      const similarity = calculateCosineSimilarity(queryEmbedding.data, chunkEmbedding.data);

      return {
        file: chunk.file,
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        similarity: similarity
      };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
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
}

// Optimized cosine similarity calculation
function calculateCosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Use single loop for better performance
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Search with enhanced natural language support
export async function searchCode(query, workingDirectory, folders = ['.'], extensions = DEFAULT_EXTS, topK = 6) {
  try {
    // Validate working directory
    if (!existsSync(workingDirectory)) {
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
    throw new Error(`Search failed: ${error.message}`);
  }
}

export async function searchSemantic(query, options = {}) {
  const { workingDirectory, folders = ['.'], extensions = DEFAULT_EXTS, topK = 6 } = options;
  return await searchCode(query, workingDirectory, folders, extensions, topK);
}