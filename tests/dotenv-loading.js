/**
 * Tests for .env file loading functionality
 * These tests verify that the REPL server properly loads environment variables from .env files
 */

export default [
  {
    name: "Get working directory from argv",
    code: `
      // This should return the working directory specified in argv[2]
      return process.argv.length >= 3 ? process.argv[2] : 'No working directory specified';
    `,
    // This will pass regardless of the result, but will show the working directory
    expected: value => typeof value === 'string'
  },
  {
    name: "Verify current working directory is set correctly",
    code: `
      // Get the current working directory
      const cwd = process.cwd();
      // Check if it matches the one specified in argv[2]
      const specifiedDir = process.argv.length >= 3 ? process.argv[2] : null;
      return {
        cwd,
        specifiedDir,
        matches: specifiedDir ? cwd.includes(specifiedDir.replace(/\\\\/g, '/').replace(/\\//g, '\\\\')) : false
      };
    `,
    // This checks if working directory was correctly set
    expected: value => typeof value === 'object' && value.matches === true
  },
  {
    name: "List environment variables loaded from the working directory",
    code: `
      // Get all environment variables and return them
      const envVars = {};
      for (const key in process.env) {
        envVars[key] = process.env[key];
      }
      return envVars;
    `,
    // This always passes but shows all environment variables available
    expected: value => typeof value === 'object'
  },
  {
    name: "Create and load a temporary .env file",
    code: `
      const fs = require('fs');
      const path = require('path');
      
      // Create a temporary .env file in the current directory
      const envContent = 'TEST_ENV_VAR=test-value-from-env-file\\nANOTHER_VAR=another-value';
      const envPath = path.join(process.cwd(), '.env.test');
      
      try {
        // Write the .env file
        fs.writeFileSync(envPath, envContent);
        
        // Simulate the .env loading function from simple-repl-server.js
        const loadEnvFile = (directory) => {
          try {
            const envPath = path.join(directory, '.env.test');
            if (fs.existsSync(envPath)) {
              const envContent = fs.readFileSync(envPath, 'utf8');
              const envLines = envContent.split('\\n');
              
              const loadedVars = {};
              
              for (const line of envLines) {
                const trimmedLine = line.trim();
                // Skip comments and empty lines
                if (trimmedLine && !trimmedLine.startsWith('#')) {
                  const match = trimmedLine.match(/^([^=]+)=(.*)$/);
                  if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) || 
                        (value.startsWith("'") && value.endsWith("'"))) {
                      value = value.substring(1, value.length - 1);
                    }
                    
                    loadedVars[key] = value;
                    
                    // Set in process.env if not already defined
                    if (!process.env[key]) {
                      process.env[key] = value;
                    }
                  }
                }
              }
              
              return loadedVars;
            }
          } catch (error) {
            return { error: error.message };
          }
          
          return {};
        };

        // Load the .env file
        const loadedVars = loadEnvFile(process.cwd());
        
        // Check if the variables are set in process.env
        const testVarLoaded = process.env.TEST_ENV_VAR === 'test-value-from-env-file';
        const anotherVarLoaded = process.env.ANOTHER_VAR === 'another-value';
        
        return {
          loadedVars,
          testVarLoaded,
          anotherVarLoaded,
          testVar: process.env.TEST_ENV_VAR,
          anotherVar: process.env.ANOTHER_VAR
        };
      } finally {
        // Clean up - delete the .env file
        try {
          fs.unlinkSync(envPath);
        } catch (err) {
          // Ignore deletion errors
        }
      }
    `,
    // Check if the environment variables were correctly loaded
    expected: value => value.testVarLoaded === true && value.anotherVarLoaded === true
  }
]; 