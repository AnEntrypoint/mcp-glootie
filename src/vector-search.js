#!/usr/bin/env node
// Cross-platform vector search with architecture detection

import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';
import ignore from 'ignore';

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
const DEFAULT_MODEL = platform.isARM64 ? 'Xenova/all-MiniLM-L6-v2' : 'Xenova/all-MiniLM-L6-v2';
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

const INDEX_FILE = 'code_index.json';
const VECTOR_INDEX_FILE = 'vector_index.json';

// Platform-specific configuration
const platformConfig = {
  memoryLimit: platform.isARM64 ? 1024 * 1024 * 1024 : 512 * 1024 * 1024, // 1GB for ARM64, 512MB for others
  batchSize: platform.isARM64 ? 32 : 16, // Larger batch size for ARM64
  maxConcurrency: platform.isARM64 ? 4 : 2, // Higher concurrency for ARM64
  timeout: platform.isARM64 ? 60000 : 30000 // Longer timeout for ARM64
};

// Global state
let codeChunks = [];
let embeddingExtractor = null;
let isInitialized = false;

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

  // Add default ignore patterns
  ig.add(DEFAULT_IGNORES);

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

  // Additional filtering for known non-code files even with allowed extensions
  const filename = path.basename(filePath);
  const excludedFiles = [
    // Minified/bundled JS
    '*.min.js', '*.bundle.js', '*.pack.js',
    // TypeScript definitions
    '*.d.ts', '*.d.tsx',
    // Source maps
    '*.map', '*.css.map',
    // Package files
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    // Config files
    'tsconfig.json', 'jsconfig.json',
    // Linter configs
    '.eslintrc.*', '.prettierrc.*',
    // Documentation
    'LICENSE*', 'README*', '*.md', 'CHANGELOG*',
    // Docker
    'Dockerfile*', 'docker-compose*.yml'
  ];

  return !excludedFiles.some(excluded => filename.match(excluded.replace(/\*/g, '.*')));
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

    isInitialized = true;
    return true;
  } catch (error) {
    throw new Error(`Vector search initialization failed: ${error.message}`);
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

  for (const folder of folders) {
    const ignoreFilter = createIgnoreFilter(folder);
    await scanDirectory(folder, ignoreFilter, files, exts);
  }

  // Process files into chunks
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
        // Truncate to first MAX_FILE_SIZE characters
        content = content.substring(0, MAX_FILE_SIZE);
      }

      const chunks = processCodeIntoChunks(content, file);
      newChunks.push(...chunks);
    } catch (error) {
    }
  }


  codeChunks = newChunks;

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

// Query the index with semantic search
export async function queryIndex(query, topK = 8) {
  if (!isInitialized) {
    await initialize();
  }

  if (codeChunks.length === 0) {
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await embeddingExtractor(query, {
    pooling: 'mean',
    normalize: true
  });

  // Calculate similarity with all chunks
  const results = [];
  for (let i = 0; i < codeChunks.length; i++) {
    const chunk = codeChunks[i];
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