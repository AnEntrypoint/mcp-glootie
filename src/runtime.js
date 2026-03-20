import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

function findBin(...candidates) {
  const probe = process.platform === 'win32' ? b => `where ${b}` : b => `which ${b}`;
  for (const bin of candidates) {
    try { execSync(probe(bin), { stdio: 'ignore', timeout: 3000, windowsHide: true }); return bin; } catch {}
  }
  return candidates[0];
}

const IS_WIN = process.platform === 'win32';
const PYTHON = findBin('python3', 'python');
const SHELL = IS_WIN ? 'cmd.exe' : findBin('bash', 'sh');
const POWERSHELL = findBin('pwsh', 'powershell');
const BASH = findBin('bash');
const DENO = findBin('deno');
const GO = findBin('go');
const RUSTC = findBin('rustc');
const GCC = findBin('gcc');
const GPP = findBin('g++');
const JAVA = findBin('java');
const JAVAC = findBin('javac');

const SIGTERM_TIMEOUT = 5000;

function killChild(child) {
  try {
    if (IS_WIN) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    else { child.kill('SIGTERM'); setTimeout(() => { try { if (!child.killed) child.kill('SIGKILL'); } catch {} }, SIGTERM_TIMEOUT); }
  } catch {}
}

function makeTmp(ext, content) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'glootie_'));
  const file = path.join(dir, `code${ext}`);
  writeFileSync(file, content);
  return { dir, file };
}

function spawnOpts(cwd, stdin = 'pipe') {
  return { cwd: cwd || process.cwd(), stdio: [stdin, 'pipe', 'pipe'], detached: false, windowsHide: true };
}

export function spawnProcess(runtime, code, cwd) {
  let tmpDir = null;
  const cleanup = () => { if (tmpDir) { try { rmSync(tmpDir, { recursive: true, force: true }); } catch {} tmpDir = null; } };

  if (runtime === 'nodejs' || runtime === 'typescript') {
    const child = spawn('bun', ['-e', code], spawnOpts(cwd));
    return { child, cleanup };
  }
  if (runtime === 'python') {
    const child = spawn(PYTHON, ['-c', code], spawnOpts(cwd));
    return { child, cleanup };
  }
  if (runtime === 'powershell') {
    const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', code], spawnOpts(cwd));
    return { child, cleanup };
  }
  if (runtime === 'cmd') {
    const child = spawn('cmd.exe', ['/c', code], spawnOpts(cwd));
    return { child, cleanup };
  }
  if (runtime === 'bash') {
    const { dir, file } = makeTmp('.sh', code);
    tmpDir = dir;
    const child = spawn(BASH, [file], spawnOpts(cwd));
    return { child, cleanup };
  }
  if (runtime === 'deno') {
    const { dir, file } = makeTmp('.ts', code);
    tmpDir = dir;
    const child = spawn(DENO, ['run', '--no-check', file], spawnOpts(cwd));
    return { child, cleanup };
  }
  if (['go', 'rust', 'c', 'cpp'].includes(runtime)) {
    const ext = { go: '.go', rust: '.rs', c: '.c', cpp: '.cpp' }[runtime];
    const { dir, file } = makeTmp(ext, code);
    tmpDir = dir;
    const binExt = IS_WIN ? '.exe' : '';
    const binPath = path.join(dir, `code${binExt}`);
    if (runtime === 'go') {
      const child = spawn(GO, ['run', file], spawnOpts(cwd));
      return { child, cleanup };
    }
    const compiler = { rust: RUSTC, c: GCC, cpp: GPP }[runtime];
    const compileArgs = runtime === 'rust' ? [file, '-o', binPath] : [file, '-o', binPath, '-I', cwd];
    const compileChild = spawn(compiler, compileArgs, spawnOpts(cwd));
    return { child: compileChild, isCompile: true, binPath, cleanup, dir, killChild };
  }
  if (runtime === 'java') {
    const className = 'Main';
    const { dir, file } = makeTmp('.java', `public class ${className} {\n  public static void main(String[] args) {\n${code.split('\n').map(l => '    ' + l).join('\n')}\n  }\n}`);
    tmpDir = dir;
    const cpSep = IS_WIN ? ';' : ':';
    const cp = [dir, cwd].join(cpSep);
    const compileChild = spawn(JAVAC, ['-cp', cp, file.replace('.java', '.java')], spawnOpts(cwd));
    return { child: compileChild, isCompile: true, runtime: 'java', dir, cp, className, cleanup, killChild };
  }
  throw new Error(`Unsupported runtime: ${runtime}`);
}

export { killChild };
