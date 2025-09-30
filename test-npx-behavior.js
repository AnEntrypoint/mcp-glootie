import { spawn } from 'child_process';

console.log('Testing: npx -y mcp-glootie\n');

const proc = spawn('cmd.exe', ['/c', 'npx', '-y', 'mcp-glootie'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let hasOutput = false;
let exited = false;

proc.stdout.on('data', (data) => {
  hasOutput = true;
  console.log('STDOUT:', data.toString());
});

proc.stderr.on('data', (data) => {
  hasOutput = true;
  console.error('STDERR:', data.toString());
});

proc.on('exit', (code) => {
  exited = true;
  console.log(`\nProcess exited with code: ${code}`);

  if (code === 0 && !hasOutput) {
    console.log('⚠️  Process exited cleanly but produced no output - this is wrong for an MCP server');
  }
});

// Give it time to start
setTimeout(() => {
  if (exited) {
    console.log('❌ Process already exited - it closed immediately');
    process.exit(1);
  }

  console.log('✓ Process is still running after 2 seconds');
  console.log('Sending JSON-RPC initialize request...\n');

  const initMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' }
    }
  }) + '\n';

  proc.stdin.write(initMsg);
}, 2000);

setTimeout(() => {
  if (hasOutput) {
    console.log('\n✓ SUCCESS: Server responded to input');
  } else {
    console.log('\n❌ FAILED: No response from server');
  }
  proc.kill();
  process.exit(0);
}, 5000);