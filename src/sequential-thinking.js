// Sequential thinking core functionality with local storage - KISS principle under 110 lines
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

export class SequentialThinking {
  constructor(workingDirectory) {
    if (!workingDirectory) throw new Error('Working directory is required for sequential thinking');
    
    this.workingDir = resolve(workingDirectory);
    this.storageDir = join(this.workingDir, '.sequential-thoughts');
    this.thoughtsFile = join(this.storageDir, 'thoughts.json');
    this.branchesFile = join(this.storageDir, 'branches.json');
    this.historyFile = join(this.storageDir, 'history.json');
    this.ensureStorageExists();
  }

  ensureStorageExists() {
    if (!existsSync(this.storageDir)) mkdirSync(this.storageDir, { recursive: true });
    if (!existsSync(this.thoughtsFile)) this.saveJson(this.thoughtsFile, { thoughts: [], nextId: 1 });
    if (!existsSync(this.branchesFile)) this.saveJson(this.branchesFile, { branches: {}, activeBranch: null });
    if (!existsSync(this.historyFile)) this.saveJson(this.historyFile, { history: [], totalThoughts: 0 });
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

  processThoughts(thoughts, parentId = null) {
    const startTime = Date.now();
    const thoughtsArray = Array.isArray(thoughts) ? thoughts : [thoughts];
    const thoughtsData = this.loadJson(this.thoughtsFile);
    const branchesData = this.loadJson(this.branchesFile);
    const historyData = this.loadJson(this.historyFile);

    if (!thoughtsData || !branchesData || !historyData) {
      throw new Error('Failed to load thought data from storage');
    }

    const processedThoughts = thoughtsArray.map(content => {
      const thought = this.createThought(content, parentId, thoughtsData.nextId++);
      thoughtsData.thoughts.push(thought);
      historyData.history.push({ action: 'create', thoughtId: thought.id, timestamp: thought.timestamp });
      return thought;
    });

    historyData.totalThoughts += processedThoughts.length;
    const saveSuccess = this.saveJson(this.thoughtsFile, thoughtsData) &&
                       this.saveJson(this.branchesFile, branchesData) &&
                       this.saveJson(this.historyFile, historyData);

    if (!saveSuccess) throw new Error('Failed to save thought data to storage');

    return {
      success: true,
      processedCount: processedThoughts.length,
      thoughts: processedThoughts,
      storageLocation: this.storageDir,
      executionTimeMs: Date.now() - startTime
    };
  }

  createThought(content, parentId, id) {
    const timestamp = new Date().toISOString();
    const branchId = parentId ? `branch_${parentId.split('_')[1] || Date.now()}` : `branch_${Date.now()}`;
    
    return {
      id: `thought_${id}`,
      content: content.trim(),
      timestamp,
      parentId,
      workingDirectory: this.workingDir,
      metadata: {
        depth: parentId ? 1 : 0,
        branchId,
        contentLength: content.length,
        processed: true
      }
    };
  }
}