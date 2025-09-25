#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { execSync } from 'child_process';

const ANALYSIS_METADATA_FILE = './.mcp-file-analysis-metadata.json';
const METADATA_DIR = './.mcp-metadata';

export class FileAnalysisTracker {
  constructor(workingDirectory) {
    this.workingDirectory = workingDirectory;
    this.metadataFile = join(workingDirectory, ANALYSIS_METADATA_FILE);
    this.metadataDir = join(workingDirectory, METADATA_DIR);
    this.fileMetadata = new Map(); // In-memory cache

    this.loadMetadata();
  }

  async initialize() {
    // Create metadata directory if it doesn't exist
    try {
      if (!existsSync(this.metadataDir)) {
        mkdirSync(this.metadataDir, { recursive: true });
      }
    } catch (error) {
      // Ignore directory creation errors
    }

    // Load existing metadata
    await this.loadMetadata();

    // Build initial file modification dates cache
    await this.buildFileModificationCache();
  }

  async loadMetadata() {
    try {
      if (existsSync(this.metadataFile)) {
        const data = readFileSync(this.metadataFile, 'utf8');
        const parsed = JSON.parse(data);

        // Convert array back to Map for easier handling
        this.fileMetadata = new Map(
          parsed.files.map(file => [file.path, file])
        );
      }
    } catch (error) {
      // Start with empty metadata if loading fails
      this.fileMetadata = new Map();
    }
  }

  async saveMetadata() {
    try {
      // Convert Map to array for JSON serialization
      const filesArray = Array.from(this.fileMetadata.values());

      const data = {
        version: '1.0',
        lastUpdated: Date.now(),
        workingDirectory: this.workingDirectory,
        files: filesArray
      };

      // Ensure directory exists
      const dir = dirname(this.metadataFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.metadataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to save file analysis metadata:', error.message);
    }
  }

  async buildFileModificationCache() {
    try {
      // Get all tracked files from git
      const gitFiles = this.getGitTrackedFiles();

      // Update modification dates for all files
      for (const filePath of gitFiles) {
        const fullPath = join(this.workingDirectory, filePath);
        if (existsSync(fullPath)) {
          const stats = statSync(fullPath);
          this.updateFileMetadata(filePath, stats.mtime);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to build file modification cache:', error.message);
    }
  }

  getGitTrackedFiles() {
    try {
      // Get all files tracked by git
      const output = execSync('git ls-files', {
        encoding: 'utf8',
        cwd: this.workingDirectory,
        timeout: 10000
      });

      return output.trim().split('\n').filter(file => file);
    } catch (error) {
      // Return empty array if git command fails
      return [];
    }
  }

  getGitModifiedFiles() {
    try {
      // Get modified files from git status
      const output = execSync('git status --porcelain', {
        encoding: 'utf8',
        cwd: this.workingDirectory,
        timeout: 10000
      });

      const modifiedFiles = [];
      const lines = output.trim().split('\n');

      for (const line of lines) {
        if (line.trim()) {
          // Parse git status output: XY path/to/file
          const status = line.substring(0, 2);
          const filePath = line.substring(3);

          // Only track files that are actually modified (M), added (A), or renamed (R)
          if (status.includes('M') || status.includes('A') || status.includes('R')) {
            modifiedFiles.push(filePath);
          }
        }
      }

      return modifiedFiles;
    } catch (error) {
      // Return empty array if git command fails
      return [];
    }
  }

  updateFileMetadata(filePath, modifiedDate) {
    const existing = this.fileMetadata.get(filePath) || {
      path: filePath,
      firstSeen: Date.now(),
      lastReported: null,
      reportedDates: new Set()
    };

    existing.lastModified = modifiedDate.getTime();
    existing.lastUpdated = Date.now();

    this.fileMetadata.set(filePath, existing);
  }

  hasBeenReported(filePath, modifiedDate) {
    const metadata = this.fileMetadata.get(filePath);
    if (!metadata) return false;

    const modifiedTime = modifiedDate.getTime();

    // Check if this exact modification date has been reported
    if (metadata.reportedDates && metadata.reportedDates.has(modifiedTime)) {
      return true;
    }

    return false;
  }

  markAsReported(filePath, modifiedDate) {
    const metadata = this.fileMetadata.get(filePath);
    if (!metadata) {
      // Create new metadata entry if it doesn't exist
      this.updateFileMetadata(filePath, modifiedDate);
      const newMetadata = this.fileMetadata.get(filePath);
      newMetadata.reportedDates = new Set([modifiedDate.getTime()]);
      newMetadata.lastReported = modifiedDate.getTime();
    } else {
      // Update existing metadata
      if (!metadata.reportedDates) {
        metadata.reportedDates = new Set();
      }
      metadata.reportedDates.add(modifiedDate.getTime());
      metadata.lastReported = modifiedDate.getTime();
    }
  }

  getNewlyModifiedFiles() {
    const gitModifiedFiles = this.getGitModifiedFiles();
    const newlyModifiedFiles = [];

    for (const filePath of gitModifiedFiles) {
      const fullPath = join(this.workingDirectory, filePath);

      if (existsSync(fullPath)) {
        const stats = statSync(fullPath);
        const modifiedDate = stats.mtime;

        // Update file metadata
        this.updateFileMetadata(filePath, modifiedDate);

        // Check if this modification has been reported
        if (!this.hasBeenReported(filePath, modifiedDate)) {
          newlyModifiedFiles.push({
            path: filePath,
            fullPath,
            modifiedDate,
            stats
          });
        }
      }
    }

    return newlyModifiedFiles;
  }

  async processChanges(changes) {
    // Mark all provided changes as reported
    for (const change of changes) {
      const fullPath = change.file || change.fullPath;
      if (fullPath) {
        const relativePath = fullPath.startsWith(this.workingDirectory)
          ? fullPath.substring(this.workingDirectory.length + 1)
          : fullPath;

        const stats = existsSync(fullPath) ? statSync(fullPath) : null;
        const modifiedDate = stats ? stats.mtime : new Date();

        this.markAsReported(relativePath, modifiedDate);
      }
    }

    // Save updated metadata
    await this.saveMetadata();
  }

  getAnalysisSummary() {
    const totalFiles = this.fileMetadata.size;
    const reportedFiles = Array.from(this.fileMetadata.values()).filter(
      f => f.lastReported && f.reportedDates && f.reportedDates.size > 0
    ).length;

    return {
      totalTrackedFiles: totalFiles,
      filesWithAnalysis: reportedFiles,
      lastUpdated: new Date().toISOString()
    };
  }

  clearCache() {
    this.fileMetadata.clear();
  }

  // Utility method to reset all tracking (for testing or manual reset)
  async reset() {
    try {
      if (existsSync(this.metadataFile)) {
        const { unlinkSync } = await import('fs');
        unlinkSync(this.metadataFile);
      }
      this.fileMetadata.clear();
      await this.buildFileModificationCache();
    } catch (error) {
      console.warn('⚠️ Failed to reset file analysis tracker:', error.message);
    }
  }
}

// Singleton instance for the application
let trackerInstance = null;

export async function getFileAnalysisTracker(workingDirectory) {
  if (!trackerInstance) {
    trackerInstance = new FileAnalysisTracker(workingDirectory);
    await trackerInstance.initialize();
  }
  return trackerInstance;
}

export async function resetFileAnalysisTracker() {
  if (trackerInstance) {
    await trackerInstance.reset();
    trackerInstance = null;
  }
}

export default {
  FileAnalysisTracker,
  getFileAnalysisTracker,
  resetFileAnalysisTracker
};