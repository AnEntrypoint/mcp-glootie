import { activeProcesses } from './process-manager.js';

export function getRunningProcessesList() {
   if (activeProcesses.size === 0) return '';
   const processList = Array.from(activeProcesses.entries()).map(([pid, proc]) => {
     const elapsed = Date.now() - proc.startTime;
     return `  - ${pid} (${elapsed}ms elapsed)`;
   }).join('\n');
   return `\nRunning processes:\n${processList}`;
}

export function formatExecutionOutput(result) {
   const parts = [];

   if (result.stdout) {
     parts.push(`[STDOUT]\n${result.stdout}`);
   }

   if (result.stderr) {
     parts.push(`[STDERR]\n${result.stderr}`);
   }

   if (parts.length === 0) {
     parts.push('(no output)');
   }

   return parts.join('\n\n');
}

export function formatExecutionContext(result) {
   const context = [
     `Exit code: ${result.code}`,
     `Time: ${result.executionTimeMs}ms`
   ];

   if (result.stdout) {
     context.push(`Stdout size: ${result.stdout.length} bytes`);
   }
   if (result.stderr) {
     context.push(`Stderr size: ${result.stderr.length} bytes`);
   }

   return context.join(' | ');
}
