#!/usr/bin/env node
// ARM64-compatible vector search using transformers.js

import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';
import ignore from 'ignore';

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
  return ig;
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
  const ignoreFilter = createIgnoreFilter(process.cwd());

  for (const folder of folders) {
    await scanDirectory(folder, ignoreFilter, files, exts);
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

// Helper function to scan directories with proper .gitignore support
async function scanDirectory(dir, ignoreFilter, files, exts) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      // Check if file/directory should be ignored using the ignore library
      if (ignoreFilter.ignores(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(fullPath, ignoreFilter, files, exts);
      } else if (entry.isFile()) {
        // Check if this file should be indexed based on extension and content type
        if (shouldIndexFile(fullPath, exts)) {
          // Check file size - skip files larger than 200KB
          try {
            const stat = await fs.stat(fullPath);
            if (stat.size <= 200 * 1024) { // 200KB limit
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
export async function searchCode(query, workingDirectory, folders = ['.'], extensions = DEFAULT_EXTS, topK = 6) {
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

export async function searchSemantic(query, options = {}) {
  const { workingDirectory, folders = ['.'], extensions = DEFAULT_EXTS, topK = 6 } = options;
  return await searchCode(query, workingDirectory, folders, extensions, topK);
}