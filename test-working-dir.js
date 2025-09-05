// Test file to verify working directory functionality
console.log('Working directory test file executed successfully');
console.log('Current working directory:', process.cwd());
console.log('Files in current directory:', require('fs').readdirSync('.').slice(0, 5));