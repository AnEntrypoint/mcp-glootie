// Lightweight semantic search for ARM64 compatibility
// Uses NLP techniques without heavy ML dependencies

import fs from 'fs/promises';
import path from 'path';

// Simple text similarity using TF-IDF + cosine similarity
class LightSemanticSearch {
  constructor() {
    this.documents = [];
    this.documentMap = new Map();
    this.isInitialized = false;
  }

  // Extract meaningful keywords from text
  extractKeywords(text) {
    const keywords = [];
    
    // Extract function names, variable names, and class names
    const functionMatches = text.match(/(?:function|class|const|let|var)\s+(\w+)/g);
    if (functionMatches) {
      functionMatches.forEach(match => {
        const name = match.split(/\s+/)[1];
        keywords.push(name.toLowerCase());
      });
    }
    
    // Extract method calls
    const methodMatches = text.match(/(\w+)\.\w+\(/g);
    if (methodMatches) {
      methodMatches.forEach(match => {
        const object = match.split('.')[0];
        keywords.push(object.toLowerCase());
      });
    }
    
    // Extract important keywords
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'could']);
    
    const words = text.toLowerCase().match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    words.forEach(word => {
      if (word.length > 2 && !commonWords.has(word) && word.match(/^[a-z]/)) {
        keywords.push(word);
      }
    });
    
    return keywords;
  }

  // Calculate TF-IDF similarity
  calculateSimilarity(queryKeywords, documentKeywords) {
    const allKeywords = new Set([...queryKeywords, ...documentKeywords]);
    const queryVector = [];
    const docVector = [];
    
    allKeywords.forEach(keyword => {
      queryVector.push(queryKeywords.filter(k => k === keyword).length);
      docVector.push(documentKeywords.filter(k => k === keyword).length);
    });
    
    // Calculate cosine similarity
    const dotProduct = queryVector.reduce((sum, val, i) => sum + val * docVector[i], 0);
    const queryMagnitude = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
    const docMagnitude = Math.sqrt(docVector.reduce((sum, val) => sum + val * val, 0));
    
    if (queryMagnitude === 0 || docMagnitude === 0) return 0;
    return dotProduct / (queryMagnitude * docMagnitude);
  }

  // Index code files
  async indexFiles(folders, exts = ['js', 'ts'], ignores = []) {
    console.log('[DEBUG] Starting lightweight semantic indexing...');
    
    for (const folder of folders) {
      await this.scanDirectory(folder, exts, ignores);
    }
    
    this.isInitialized = true;
    console.log(`[DEBUG] Indexed ${this.documents.length} files`);
  }

  async scanDirectory(dir, exts, ignores, depth = 0) {
    if (depth > 5) return; // Prevent infinite recursion
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath);
        
        // Skip ignored files/directories
        if (ignores.some(pattern => {
          if (pattern.endsWith('/')) {
            return relativePath.startsWith(pattern) || fullPath.startsWith(pattern);
          } else {
            return relativePath.includes(pattern) || fullPath.includes(pattern);
          }
        })) {
          continue;
        }
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await this.scanDirectory(fullPath, exts, ignores, depth + 1);
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop().toLowerCase();
          if (exts.includes(ext)) {
            try {
              const content = await fs.readFile(fullPath, 'utf8');
              const keywords = this.extractKeywords(content);
              
              const doc = {
                id: this.documents.length,
                path: relativePath,
                fullPath: fullPath,
                keywords: keywords,
                content: content.substring(0, 5000), // Store first 5KB for context
                language: ext
              };
              
              this.documents.push(doc);
              this.documentMap.set(relativePath, doc);
              
            } catch (err) {
              console.log(`[DEBUG] Failed to index ${relativePath}:`, err.message);
            }
          }
        }
      }
    } catch (err) {
      console.log(`[DEBUG] Failed to scan directory ${dir}:`, err.message);
    }
  }

  // Search using semantic similarity
  async search(query, topK = 8) {
    if (!this.isInitialized) {
      throw new Error('Search not initialized. Call indexFiles first.');
    }
    
    const queryKeywords = this.extractKeywords(query);
    
    // Calculate similarity scores
    const results = this.documents.map(doc => ({
      document: doc,
      score: this.calculateSimilarity(queryKeywords, doc.keywords),
      keywordOverlap: doc.keywords.filter(k => queryKeywords.includes(k)).length
    }));
    
    // Sort by relevance (combine similarity and keyword overlap)
    results.sort((a, b) => {
      const scoreA = a.score + (a.keywordOverlap * 0.1);
      const scoreB = b.score + (b.keywordOverlap * 0.1);
      return scoreB - scoreA;
    });
    
    // Return top results with context
    return results.slice(0, topK).map(result => ({
      file: result.document.path,
      score: result.score,
      keywordOverlap: result.keywordOverlap,
      context: this.extractRelevantContext(result.document.content, queryKeywords),
      language: result.document.language
    }));
  }

  // Extract relevant context around keywords
  extractRelevantContext(content, keywords) {
    const lines = content.split('\n');
    const relevantLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (keywords.some(keyword => line.toLowerCase().includes(keyword))) {
        // Include this line and surrounding lines for context
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        const context = lines.slice(start, end);
        relevantLines.push({
          lineNumbers: [start + 1, end],
          text: context.join('\n')
        });
      }
    }
    
    return relevantLines.slice(0, 3); // Limit to 3 contexts per file
  }
}

// Singleton instance
let searchInstance = null;

async function getLightSearchInstance() {
  if (!searchInstance) {
    searchInstance = new LightSemanticSearch();
  }
  return searchInstance;
}

export async function lightweightSearch(args) {
  const { query, workingDirectory, folders, extensions, ignores, topK } = args;
  
  if (!query || !workingDirectory) {
    throw new Error('Query and working directory are required');
  }
  
  const searchInstance = await getLightSearchInstance();
  
  // Set defaults
  const searchFolders = folders ? folders.split(',').map(f => path.join(workingDirectory, f.trim())) : [workingDirectory];
  const searchExts = extensions ? extensions.split(',').map(e => e.trim()) : ['js', 'ts'];
  const searchIgnores = ignores ? ignores.split(',').map(i => i.trim()) : ['node_modules', '.git', '.next', 'dist', 'build'];
  const searchTopK = topK || 8;
  
  // Index files if not already indexed
  if (!searchInstance.isInitialized) {
    await searchInstance.indexFiles(searchFolders, searchExts, searchIgnores);
  }
  
  // Perform search
  const results = await searchInstance.search(query, searchTopK);
  
  // Format results
  let output = `Lightweight semantic search results for "${query}":\n\n`;
  
  results.forEach((result, index) => {
    output += `${index + 1}. ${result.file} (score: ${result.score.toFixed(3)}, keyword overlap: ${result.keywordOverlap})\n`;
    output += `   Language: ${result.language}\n`;
    
    if (result.context.length > 0) {
      output += '   Context:\n';
      result.context.forEach(ctx => {
        output += `   Lines ${ctx.lineNumbers[0]}-${ctx.lineNumbers[1]}:\n`;
        output += `   ${ctx.text}\n\n`;
      });
    }
    output += '\n';
  });
  
  return output;
}