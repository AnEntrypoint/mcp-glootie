#!/usr/bin/env node

import { getFileAnalysisTracker } from './src/core/file-analysis-tracker.js';

console.log('Starting initialization test...');

try {
  console.log('Calling getFileAnalysisTracker...');
  const tracker = await getFileAnalysisTracker(process.cwd());
  console.log('Tracker initialized successfully!');
  console.log('Summary:', tracker.getAnalysisSummary());
  console.log('Test completed successfully');
  process.exit(0);
} catch (error) {
  console.error('Initialization failed:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}