# Implementation Guide

## Project Setup
1. Install Node.js (>=14.0.0)
2. Clone the repository
3. Run `npm install` to install dependencies

## Development Workflow

### Running the Server
```bash
npm start
# or
node universal-repl-server.js
```

### Testing
```bash
npm test           # Run all tests
npm test --quick   # Run quick tests only
```

### Adding New Features
1. Create test cases in `/tests` directory
2. Implement feature in relevant files
3. Update test expectations using `update-test-expectations.js`
4. Verify all tests pass

### Error Handling Guidelines
- Use custom error classes for specific error types
- Include stack traces for debugging
- Format error messages consistently
- Handle async/await errors properly

### Security Considerations
- Validate all input code
- Implement memory limits
- Set execution timeouts
- Restrict access to sensitive modules
- Sanitize error messages

### MCP Protocol Implementation
- Follow MCP stdio specification
- Implement required MCP endpoints
- Handle protocol-specific errors
- Format responses according to MCP standard

## Deployment
1. Build the package: `npm pack`
2. Publish to npm: `npm publish`
3. Deploy as a service using process manager
4. Monitor memory and CPU usage