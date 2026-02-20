import { executeCode as rpcExecuteCode } from '../rpc-client.js';

const validate = {
  execute({ code, workingDirectory }) {
    if (!code || typeof code !== 'string') return 'Error: code must be a non-empty string';
    if (!workingDirectory || typeof workingDirectory !== 'string') return 'Error: workingDirectory must be a non-empty string';
    return null;
  },
  bash({ commands, workingDirectory }) {
    if (!commands) return 'Error: commands must be provided';
    if (!workingDirectory || typeof workingDirectory !== 'string') return 'Error: workingDirectory must be a non-empty string';
    return null;
  }
};

export async function executeCode(code, runtime, workingDirectory, timeout = 30000, backgroundTaskId = null) {
  return rpcExecuteCode(code, runtime, workingDirectory, timeout, backgroundTaskId);
}

export { validate };
