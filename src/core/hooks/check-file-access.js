#!/usr/bin/env node

// Hook for checking file access permissions before read/edit operations
import { existsSync, readFileSync } from 'fs';
import { accessSync, constants } from 'fs';

const toolName = process.argv[2];
const toolArgs = JSON.parse(process.argv[3] || '{}');

console.log(`🔍 Checking file access for ${toolName} operation...`);

// Extract file paths from different tool types
let filesToCheck = [];

if (toolName === 'Read') {
  filesToCheck = [toolArgs.file_path];
} else if (toolName === 'Edit') {
  filesToCheck = [toolArgs.file_path];
} else if (toolName === 'Write') {
  filesToCheck = [toolArgs.file_path];
} else if (toolName === 'MultiEdit') {
  filesToCheck = toolArgs.edits?.map(edit => edit.file_path) || [];
}

const accessIssues = [];

// Check each file
for (const filePath of filesToCheck) {
  if (!filePath) {
    accessIssues.push({
      file: 'unknown',
      issue: 'No file path provided'
    });
    continue;
  }

  // Security: Check for path traversal
  if (filePath.includes('..')) {
    accessIssues.push({
      file: filePath,
      issue: 'Path traversal not allowed for security'
    });
    continue;
  }

  // Security: Skip sensitive files
  const sensitivePatterns = [
    /\.env$/,
    /\.key$/,
    /\.pem$/,
    /\.p12$/,
    /\.pfx$/,
    /\.git\//,
    /node_modules\//,
    /\.vscode\//,
    /\.idea\//,
    /\.claude\//
  ];

  if (sensitivePatterns.some(pattern => pattern.test(filePath))) {
    accessIssues.push({
      file: filePath,
      issue: 'Access to sensitive files not allowed'
    });
    continue;
  }

  try {
    // Check if file exists (except for Write operations)
    if (toolName !== 'Write' && !existsSync(filePath)) {
      accessIssues.push({
        file: filePath,
        issue: 'File does not exist'
      });
      continue;
    }

    // Check read access
    try {
      accessSync(filePath, constants.R_OK);
    } catch (error) {
      accessIssues.push({
        file: filePath,
        issue: `No read access: ${error.message}`
      });
    }

    // For write operations, check write access
    if (toolName === 'Edit' || toolName === 'Write' || toolName === 'MultiEdit') {
      try {
        accessSync(filePath, constants.W_OK);
      } catch (error) {
        accessIssues.push({
          file: filePath,
          issue: `No write access: ${error.message}`
        });
      }
    }

    // Check file size for performance
    if (existsSync(filePath)) {
      const stats = readFileSync(filePath, { encoding: 'utf8' });
      const fileSize = Buffer.byteLength(stats, 'utf8');
      const maxSize = 150 * 1024; // 150KB

      if (fileSize > maxSize) {
        accessIssues.push({
          file: filePath,
          issue: `File too large (${Math.round(fileSize / 1024)}KB > ${maxSize / 1024}KB)`,
          severity: 'warning'
        });
      }
    }

  } catch (error) {
    accessIssues.push({
      file: filePath,
      issue: `Access check failed: ${error.message}`
    });
  }
}

// Report issues
if (accessIssues.length > 0) {
  console.log('⚠️ File access issues:');
  accessIssues.forEach(issue => {
    const icon = issue.severity === 'warning' ? '⚠️' : '❌';
    console.log(`   ${icon} ${issue.file}: ${issue.issue}`);
  });

  const hasErrors = accessIssues.some(i => i.severity !== 'warning');
  if (hasErrors) {
    console.log('❌ File access validation failed');
    process.exit(1);
  } else {
    console.log('⚠️ File access has warnings but can proceed');
  }
} else {
  console.log('✅ File access validation passed');
}

console.log('✅ File access check complete');