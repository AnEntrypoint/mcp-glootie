import http from 'http';
import { readFileSync, unlinkSync } from 'fs';
import { spawnProcess, killChild } from './runtime.js';

const { TASK_ID, PORT, RUNTIME, CWD, CODE_FILE } = process.env;
const taskId = parseInt(TASK_ID, 10);
const port = parseInt(PORT, 10);

function rpc(method, params) {
  return new Promise((resolve) => {
    try {
      const body = JSON.stringify({ method, params });
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/rpc', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
        res => { res.on('data', () => {}); res.on('end', () => resolve()); }
      );
      req.on('error', () => resolve());
      req.write(body); req.end();
    } catch { resolve(); }
  });
}

const code = readFileSync(CODE_FILE, 'utf8');
try { unlinkSync(CODE_FILE); } catch {}

let activeChild = null;

process.on('message', (msg) => {
  if (msg?.data?.type === 'stdin' && activeChild?.stdin && !activeChild.stdin.destroyed) {
    try { activeChild.stdin.write(msg.data.data); } catch {}
  }
});

async function runChild(child, cleanup) {
  activeChild = child;
  let stdout = '', stderr = '';
  child.stdout?.on('data', async (d) => {
    const str = d.toString('utf8');
    stdout += str;
    process.stdout.write(str);
    await rpc('appendOutput', { taskId, type: 'stdout', data: str });
  });
  child.stderr?.on('data', async (d) => {
    const str = d.toString('utf8');
    stderr += str;
    process.stderr.write(str);
    await rpc('appendOutput', { taskId, type: 'stderr', data: str });
  });
  return new Promise((resolve) => {
    child.on('error', async (err) => {
      cleanup();
      await rpc('failTask', { taskId, error: err.message });
      resolve({ ok: false, error: err.message });
    });
    child.on('close', (code) => {
      cleanup();
      resolve({ ok: code === 0, exitCode: code, stdout, stderr });
    });
  });
}

async function runCompiled(spawnResult) {
  const { child, cleanup, binPath, dir, cp, className, isCompile } = spawnResult;
  const compileResult = await runChild(child, () => {});
  if (!compileResult.ok) {
    cleanup();
    await rpc('failTask', { taskId, error: compileResult.stderr || 'Compilation failed' });
    return;
  }
  let runChild2, runCleanup;
  if (RUNTIME === 'java') {
    const { spawn } = await import('child_process');
    const JAVA = 'java';
    runChild2 = spawn(JAVA, ['-cp', cp, className], { cwd: CWD, stdio: ['pipe','pipe','pipe'] });
    runCleanup = cleanup;
  } else {
    const { spawn } = await import('child_process');
    runChild2 = spawn(binPath, [], { cwd: CWD, stdio: ['pipe','pipe','pipe'] });
    runCleanup = cleanup;
  }
  const result = await runChild(runChild2, runCleanup);
  await rpc(result.ok ? 'completeTask' : 'failTask', result.ok
    ? { taskId, result: { success: true, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr } }
    : { taskId, error: result.stderr || 'Execution failed' });
}

process.stderr.write('[exec-process] task=' + taskId + ' runtime=' + RUNTIME + ' starting\n');
const spawnResult = spawnProcess(RUNTIME, code, CWD);
if (spawnResult.isCompile) {
  await runCompiled(spawnResult);
} else {
  const result = await runChild(spawnResult.child, spawnResult.cleanup);
  process.stderr.write('[exec-process] task=' + taskId + ' child exited code=' + result.exitCode + '\n');
  await rpc(result.ok ? 'completeTask' : 'failTask', result.ok
    ? { taskId, result: { success: true, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr } }
    : { taskId, error: result.error || result.stderr || 'Execution failed' });
}
process.stderr.write('[exec-process] task=' + taskId + ' done\n');
process.exit(0);
