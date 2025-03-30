// Simple test to verify console output works
console.log('Hello from simple-log-test.js!');
console.log('Current time:', new Date().toISOString());
console.log('NodeJS version:', process.version);

// Print some basic info
console.log('\nEnvironment info:');
console.log('- Platform:', process.platform);
console.log('- Architecture:', process.arch);
console.log('- Current directory:', process.cwd());

// Add a deliberate error to see if error output works
try {
  throw new Error('This is a test error');
} catch (error) {
  console.error('Caught error:', error.message);
} 