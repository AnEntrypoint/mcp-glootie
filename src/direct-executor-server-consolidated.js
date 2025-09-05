#!/usr/bin/env node
// Consolidated MCP REPL server - Uses modular architecture following KISS principles
// Replaces the original 1620-line monolithic server with clean, maintainable modules

// Import the streamlined server implementation  
import { startServer } from './main-server.js';

// Start server - all logic delegated to specialized modules
startServer();