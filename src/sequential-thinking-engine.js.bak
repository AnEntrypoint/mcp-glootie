// Sequential Thinking Engine v2.18.0
// Consolidated implementation with attention optimization and next-generation techniques

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { AttentionOptimizationEngine } from './attention-optimization.js';
import { NextGenOptimizationEngine } from './next-gen-optimization.js';

export class SequentialThinkingEngine {
  constructor(workingDirectory) {
    if (!workingDirectory) {
      throw new Error('Sequential thinking requires a workingDirectory parameter. Please specify the directory path where .sequential-thoughts/ data will be stored.');
    }

    this.workingDir = resolve(workingDirectory);
    this.storageDir = join(this.workingDir, '.sequential-thoughts');
    this.thoughtsFile = join(this.storageDir, 'thoughts.json');
    this.branchesFile = join(this.storageDir, 'branches.json');
    this.historyFile = join(this.storageDir, 'history.json');
    this.optimizationFile = join(this.storageDir, 'optimization.json');

    // Advanced optimization engines
    this.attentionEngine = new AttentionOptimizationEngine();
    this.nextGenEngine = new NextGenOptimizationEngine();

    // Performance metrics
    this.performanceMetrics = {
      totalThoughtsProcessed: 0,
      averageProcessingTime: 0,
      optimizationApplications: 0,
      attentionOptimizations: 0,
      learningRevisions: 0
    };

    this.ensureStorageExists();
  }

  ensureStorageExists() {
    if (!existsSync(this.storageDir)) mkdirSync(this.storageDir, { recursive: true });
    if (!existsSync(this.thoughtsFile)) this.saveJson(this.thoughtsFile, { thoughts: [], nextId: 1 });
    if (!existsSync(this.branchesFile)) this.saveJson(this.branchesFile, { branches: {}, activeBranch: null });
    if (!existsSync(this.historyFile)) this.saveJson(this.historyFile, { history: [], totalThoughts: 0 });
    if (!existsSync(this.optimizationFile)) this.saveJson(this.optimizationFile, { optimizations: [], performance: {} });
  }

  loadJson(filePath) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
      return null;
    }
  }

  saveJson(filePath, data) {
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Error saving ${filePath}:`, error.message);
      return false;
    }
  }

  async processThoughts(thoughts, parentId = null, taskContext = {}) {
    const startTime = Date.now();
    const thoughtsArray = Array.isArray(thoughts) ? thoughts : [thoughts];

    // Load existing data
    const thoughtsData = this.loadJson(this.thoughtsFile);
    const branchesData = this.loadJson(this.branchesFile);
    const historyData = this.loadJson(this.historyFile);
    const optimizationData = this.loadJson(this.optimizationFile);

    if (!thoughtsData || !branchesData || !historyData) {
      throw new Error('Failed to load thought data from storage');
    }

    // Apply attention optimization if context is provided
    let optimizedThoughts = thoughtsArray;
    if (taskContext && Object.keys(taskContext).length > 0) {
      const attentionResult = await this.attentionEngine.optimizeAttention(
        thoughtsArray.join(' '),
        taskContext
      );
      optimizedThoughts = attentionResult.optimizedContent.split('\n').filter(t => t.trim());
      this.performanceMetrics.attentionOptimizations++;
    }

    // Process thoughts with optimization
    const processedThoughts = [];
    for (const thoughtContent of optimizedThoughts) {
      const thought = this.createThought(thoughtContent, parentId, thoughtsData.nextId++, taskContext);
      thoughtsData.thoughts.push(thought);
      processedThoughts.push(thought);

      // Track in history
      historyData.history.push({
        action: 'create',
        thoughtId: thought.id,
        timestamp: thought.timestamp,
        optimizationApplied: optimizedThoughts !== thoughtsArray
      });
    }

    // Apply learning revision
    await this.reviseLearningFromThoughts(processedThoughts, taskContext);

    // Update metrics
    historyData.totalThoughts += processedThoughts.length;
    this.performanceMetrics.totalThoughtsProcessed += processedThoughts.length;
    this.performanceMetrics.averageProcessingTime =
      (this.performanceMetrics.averageProcessingTime + (Date.now() - startTime)) / 2;

    // Save data
    const saveSuccess = this.saveJson(this.thoughtsFile, thoughtsData) &&
                       this.saveJson(this.branchesFile, branchesData) &&
                       this.saveJson(this.historyFile, historyData);

    if (!saveSuccess) throw new Error('Failed to save thought data to storage');

    return {
      success: true,
      processedCount: processedThoughts.length,
      thoughts: processedThoughts,
      storageLocation: this.storageDir,
      executionTimeMs: Date.now() - startTime,
      optimizationsApplied: optimizedThoughts !== thoughtsArray,
      performanceMetrics: { ...this.performanceMetrics }
    };
  }

  createThought(content, parentId, id, taskContext = {}) {
    const timestamp = new Date().toISOString();
    const branchId = parentId ? `branch_${parentId.split('_')[1] || Date.now()}` : `branch_${Date.now()}`;

    return {
      id: `thought_${id}`,
      content: content.trim(),
      timestamp,
      parentId,
      workingDirectory: this.workingDir,
      taskContext,
      metadata: {
        depth: parentId ? this.calculateDepth(parentId) : 0,
        branchId,
        contentLength: content.length,
        processed: true,
        optimized: false
      }
    };
  }

  calculateDepth(parentId) {
    const thoughtsData = this.loadJson(this.thoughtsFile);
    if (!thoughtsData || !parentId) return 0;

    const parentThought = thoughtsData.thoughts.find(t => t.id === parentId);
    return parentThought ? (parentThought.metadata.depth || 0) + 1 : 0;
  }

  async reviseLearningFromThoughts(thoughts, taskContext) {
    // Analyze thought patterns and revise existing knowledge
    const patterns = this.extractThoughtPatterns(thoughts);

    // Update optimization strategies based on new insights
    if (patterns.length > 0) {
      const optimizationData = this.loadJson(this.optimizationFile);
      if (optimizationData) {
        optimizationData.optimizations.push({
          type: 'learning_revision',
          patterns,
          timestamp: new Date().toISOString(),
          taskContext
        });
        this.saveJson(this.optimizationFile, optimizationData);
        this.performanceMetrics.learningRevisions++;
      }
    }
  }

  extractThoughtPatterns(thoughts) {
    const patterns = [];

    // Analyze thought structure and content patterns
    const avgLength = thoughts.reduce((sum, t) => sum + t.content.length, 0) / thoughts.length;
    const depthDistribution = thoughts.reduce((acc, t) => {
      const depth = t.metadata.depth || 0;
      acc[depth] = (acc[depth] || 0) + 1;
      return acc;
    }, {});

    patterns.push({
      type: 'structure_analysis',
      averageLength: avgLength,
      depthDistribution,
      thoughtCount: thoughts.length
    });

    return patterns;
  }

  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  getThoughtHistory(limit = 50) {
    const historyData = this.loadJson(this.historyFile);
    return historyData ? historyData.history.slice(-limit) : [];
  }

  clearOptimizationData() {
    this.saveJson(this.optimizationFile, { optimizations: [], performance: {} });
    this.performanceMetrics.learningRevisions = 0;
    return true;
  }
}