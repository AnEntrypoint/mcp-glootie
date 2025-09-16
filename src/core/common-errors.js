

export function createErrorResponse(error, startTime, context = {}) {
  return {
    success: false,
    error: error?.message || error || 'Unknown error occurred',
    executionTimeMs: Date.now() - startTime,
    ...context
  };
}

export function createSuccessResponse(data, startTime, context = {}) {
  return {
    success: true,
    executionTimeMs: Date.now() - startTime,
    ...data,
    ...context
  };
}

export async function withErrorHandling(operation, startTime, context = {}) {
  try {
    const result = await operation();
    return createSuccessResponse(result, startTime, context);
  } catch (error) {
    return createErrorResponse(error, startTime, context);
  }
}

export function createParameterError(paramName, reason, startTime) {
  return createErrorResponse(
    `Parameter '${paramName}' ${reason}`,
    startTime,
    { parameterError: true, parameter: paramName }
  );
}

export function createWorkingDirectoryError(workingDirectory, reason, startTime) {
  return createErrorResponse(
    `Working directory '${workingDirectory}' ${reason}`,
    startTime,
    { workingDirectoryError: true, workingDirectory }
  );
}

export function createTimeoutError(operation, timeoutMs, startTime) {
  return createErrorResponse(
    `${operation} timed out after ${timeoutMs}ms`,
    startTime,
    { timeout: true, timeoutMs }
  );
}

export function handleProcessError(error, command, startTime) {
  let errorMessage = 'Process execution failed';
  let errorContext = { command };

  if (error.code === 'ENOENT') {
    errorMessage = `Command not found: ${command}`;
    errorContext.missingCommand = true;
  } else if (error.code === 'EACCES') {
    errorMessage = `Permission denied executing: ${command}`;
    errorContext.permissionDenied = true;
  } else if (error.signal) {
    errorMessage = `Process terminated with signal: ${error.signal}`;
    errorContext.signal = error.signal;
  } else if (error.code) {
    errorMessage = `Process failed with code: ${error.code}`;
    errorContext.exitCode = error.code;
  }

  return createErrorResponse(errorMessage, startTime, errorContext);
}

export function validateRequiredParams(params, required, startTime) {
  for (const param of required) {
    if (!params[param]) {
      return createParameterError(param, 'is required', startTime);
    }
  }
  return null; 
}