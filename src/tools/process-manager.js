import { spawn } from 'child_process';
import { execSync } from 'child_process';

export const activeProcesses = new Map();
const SIGTERM_TIMEOUT = 5000;

export function executeProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    try {
      const startTime = Date.now();
      let child;

       try {
         const spawnOptions = { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'] };
         if (process.platform === 'win32' && command === 'cmd.exe') {
           spawnOptions.shell = true;
         }
         if (options.isBashCommand) {
           spawnOptions.detached = true;
         }
         child = spawn(command, args, spawnOptions);
         if (options.isBashCommand) {
           child.unref();
         }
       } catch (e) {
         return reject(new Error(`Failed to spawn process: ${e?.message || String(e)}`));
       }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const processId = options.processId;
      activeProcesses.set(processId, { child, startTime, stdout: '', stderr: '' });

       const cleanupProcess = () => {
         try {
           if (child && !child.killed) {
             if (process.platform === 'win32') {
               try {
                 execSync(`taskkill /pid ${child.pid} /t /f`, { stdio: 'ignore' });
               } catch (e) {
                 child.kill();
               }
             } else {
               child.kill('SIGTERM');
               setTimeout(() => {
                 if (child && !child.killed) child.kill('SIGKILL');
               }, SIGTERM_TIMEOUT);
             }
           }
         } catch (e) {}
         activeProcesses.delete(processId);
       };

      const handleError = (error) => {
        if (timedOut) return;
        timedOut = true;
        cleanupProcess();
        reject(error);
      };

      const handleData = (isStderr, data) => {
        try {
          const chunk = data.toString('utf8');
          if (isStderr) {
            stderr += chunk;
          } else {
            stdout += chunk;
          }
          if (activeProcesses.has(processId)) {
            const proc = activeProcesses.get(processId);
            if (isStderr) {
              proc.stderr += chunk;
            } else {
              proc.stdout += chunk;
            }
          }
        } catch (e) {}
      };

      child.stdout?.on('data', (d) => handleData(false, d));
      child.stderr?.on('data', (d) => handleData(true, d));

       child.on('close', (code) => {
         if (timedOut) return;
         timedOut = true;
         cleanupProcess();
         resolve({
           success: code === 0,
           stdout,
           stderr,
           executionTimeMs: Date.now() - startTime,
           code
         });
       });

      child.on('error', (error) => {
        handleError(new Error(`Process error: ${error?.message || String(error)}`));
      });

      child.on('disconnect', () => {
        if (!timedOut && !child.killed) {
          handleError(new Error('Process disconnected unexpectedly'));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function getProcessStatus(processId) {
  const proc = activeProcesses.get(processId);
  if (!proc) return { error: 'Process not found', processId };

  const elapsed = Date.now() - proc.startTime;
  return {
    processId,
    elapsed,
    stdout: proc.stdout,
    stderr: proc.stderr,
    running: true
  };
}

export function closeProcess(processId) {
  const proc = activeProcesses.get(processId);
  if (!proc) return { error: 'Process not found', processId };

  try {
    if (proc.child && !proc.child.killed) {
      proc.child.kill('SIGTERM');
      setTimeout(() => {
        if (proc.child && !proc.child.killed) {
          proc.child.kill('SIGKILL');
        }
      }, SIGTERM_TIMEOUT);
    }
    activeProcesses.delete(processId);
    return {
      success: true,
      processId,
      message: `Process ${processId} terminated`
    };
  } catch (error) {
    return {
      error: `Failed to close process: ${error?.message || String(error)}`,
      processId
    };
  }
}
