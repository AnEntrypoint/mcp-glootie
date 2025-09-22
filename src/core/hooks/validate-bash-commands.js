#!/usr/bin/env node

// Hook for validating bash commands before execution
const toolArgs = JSON.parse(process.argv[2] || '{}');

console.log('🔍 Validating bash command...');

const command = toolArgs.command;

if (!command) {
  console.log('⚠️ No command provided');
  process.exit(0);
}

// Basic validation checks
const issues = [];

// Check for potentially dangerous commands
const dangerousPatterns = [
  /^rm -rf \//, // Recursive remove from root
  /^dd if=/, // Direct disk operations
  /^mkfs\./, // Filesystem creation
  /^fdisk/, // Disk partitioning
  /^:>.*\//, // Truncating system files
  /sudo rm/, // Sudo remove operations
  /^chmod 777 \//, // Making entire system writable
];

for (const pattern of dangerousPatterns) {
  if (pattern.test(command)) {
    issues.push({
      type: 'dangerous',
      message: `Potentially dangerous command detected: ${pattern}`
    });
  }
}

// Check for common mistakes
if (command.includes('&&') && !command.includes('cd') && command.includes('..')) {
  issues.push({
    type: 'warning',
    message: 'Relative path operations with && chains may have unintended behavior'
  });
}

// Check for file operations without proper quotes
if (command.includes(' ') && command.includes('.') && !command.includes('"') && !command.includes("'")) {
  const fileOps = ['cat', 'cp', 'mv', 'rm', 'ls', 'touch'];
  for (const op of fileOps) {
    if (command.startsWith(op + ' ') && command.includes(' ')) {
      issues.push({
        type: 'warning',
        message: 'File operations with spaces should use quotes for safety'
      });
      break;
    }
  }
}

// Report issues
if (issues.length > 0) {
  console.log('⚠️ Bash command validation issues:');
  issues.forEach(issue => {
    const icon = issue.type === 'dangerous' ? '🚨' : '⚠️';
    console.log(`   ${icon} ${issue.message}`);
  });

  if (issues.some(i => i.type === 'dangerous')) {
    console.log('❌ Command validation failed - dangerous operation detected');
    process.exit(1);
  } else {
    console.log('⚠️ Command has warnings but can proceed');
  }
} else {
  console.log('✅ Bash command validation passed');
}

console.log('✅ Bash command validation complete');