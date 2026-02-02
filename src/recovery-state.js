const MAX_BUFFER = 10 * 1024 * 1024;

export const recoveryState = {
  startupAttempts: 0,
  maxStartupAttempts: 5,
  backoffDelayMs: 1000,
  lastError: null,
  connected: false,

  recordStartupAttempt(error) {
    this.startupAttempts += 1;
    this.lastError = error?.message || String(error);
    this.connected = false;
  },

  recordSuccess() {
    this.startupAttempts = 0;
    this.lastError = null;
    this.connected = true;
  },

  canRetry() {
    return this.startupAttempts < this.maxStartupAttempts;
  },

  getBackoffDelay() {
    return Math.min(this.backoffDelayMs * Math.pow(2, this.startupAttempts - 1), 30000);
  },

  shouldTrimBuffer(bufferSize) {
    return bufferSize > MAX_BUFFER;
  },

  trimBuffer(bufferString) {
    if (bufferString.length <= MAX_BUFFER) return bufferString;
    const keepSize = Math.ceil(MAX_BUFFER * 0.5);
    return bufferString.slice(-keepSize);
  },

  reset() {
    this.startupAttempts = 0;
    this.lastError = null;
    this.connected = false;
  }
};
