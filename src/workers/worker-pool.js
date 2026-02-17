import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, rmSync } from 'fs';
import os from 'os';
import { backgroundStore } from '../background-tasks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  for (const e of readdirSync(os.tmpdir())) {
    if (e.startsWith('glootie_')) {
      try { rmSync(path.join(os.tmpdir(), e), { recursive: true, force: true }); } catch (_) {}
    }
  }
} catch (_) {}

export class WorkerPool extends EventEmitter {
  constructor(poolSize = 4) {
    super();
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.activeJobs = new Map();
    this.jobCounter = 0;
    this.shuttingDown = false;
    this.backgroundJobs = new Map();
    this.maxWorkerAge = 60 * 60 * 1000;
    this.healthCheckInterval = setInterval(() => this.healthCheck(), 30000);
    if (this.healthCheckInterval.unref) this.healthCheckInterval.unref();
    for (let i = 0; i < poolSize; i++) {
      try { this.addWorker(); } catch (e) {
        this.emit('poolError', new Error(`Failed initial worker: ${e.message}`));
      }
    }
  }

  healthCheck() {
    const now = Date.now();
    for (const [jobId, job] of this.activeJobs) {
      const age = now - job.startTime;
      if (age > this.maxWorkerAge) {
        const workerItem = this.workers.find(w => w.worker === job.worker);
        if (workerItem) {
          try { workerItem.worker.terminate().catch(() => {}); } catch (e) {}
          this.removeWorker(workerItem.worker);
        }
        this.activeJobs.delete(jobId);
        if (job.backgroundTaskId) {
          backgroundStore.failTask(job.backgroundTaskId, new Error('Worker timeout - killed by health check'));
        }
        if (job.reject) {
          try { job.reject(new Error('Worker timeout')); } catch (e) {}
        }
      }
    }
  }

  addWorker() {
    const worker = new Worker(path.join(__dirname, 'isolation-worker.js'));
    const workerItem = { worker, isAvailable: true };

    worker.on('message', (msg) => this.handleWorkerMessage(worker, msg));
    worker.on('error', (err) => {
      workerItem.isAvailable = false;
      this.emit('workerError', err);
      this.removeWorker(worker);
    });
    worker.on('exit', () => {
      workerItem.isAvailable = false;
      this.removeWorker(worker);
    });
    this.workers.push(workerItem);
  }

  removeWorker(worker) {
    const index = this.workers.findIndex(w => w.worker === worker);
    if (index === -1) return;
    this.workers.splice(index, 1);
    try {
      worker.removeAllListeners();
      worker.terminate().catch(() => {});
    } catch (e) {}
    if (!this.shuttingDown && this.workers.length < this.poolSize) {
      try { this.addWorker(); } catch (e) {
        this.emit('poolError', new Error(`Failed to replace worker: ${e.message}`));
      }
    }
  }

  handleWorkerMessage(worker, msg) {
    const { jobId, type, error, stdout, stderr, exitCode, streamType, data } = msg;
    const job = this.activeJobs.get(jobId) || this.backgroundJobs.get(jobId);
    if (!jobId || !job) return;

    if (type === 'output') {
      if (job.backgroundTaskId && streamType && data) {
        backgroundStore.appendOutput(job.backgroundTaskId, streamType, data);
      }
      return;
    }

    if (job.timer) clearTimeout(job.timer);

    const workerItem = this.workers.find(w => w.worker === worker);
    const result = {
      success: error ? false : exitCode === 0,
      stdout: stdout || '', stderr: stderr || '',
      exitCode: exitCode ?? 1,
      executionTimeMs: Date.now() - job.startTime,
      error: error ? new Error(error) : null
    };

    const wasBackgrounded = this.backgroundJobs.has(jobId);
    this.activeJobs.delete(jobId);
    this.backgroundJobs.delete(jobId);
    if (workerItem) workerItem.isAvailable = true;

    if (type === 'complete') {
      if (job.backgroundTaskId) {
        backgroundStore.completeTask(job.backgroundTaskId, result);
      }
      if (wasBackgrounded) {
        if (job.resolve) {
          try {
            job.resolve({ backgroundTaskId: job.backgroundTaskId, completed: true, result });
          } catch (e) {}
        }
      } else {
        if (job.resolve) {
          try { job.resolve(result); } catch (e) {}
        }
      }
    } else {
      if (job.backgroundTaskId) {
        backgroundStore.failTask(job.backgroundTaskId, new Error(error || 'Worker error'));
      }
      if (wasBackgrounded) {
        if (job.resolve) {
          try {
            job.resolve({ backgroundTaskId: job.backgroundTaskId, completed: true, result });
          } catch (e) {}
        }
      } else {
        if (job.reject) {
          try { job.reject(new Error(error || 'Worker error')); } catch (e) {}
        }
      }
    }
    this.processQueue();
  }

  async execute(code, runtime, workingDirectory, timeout = 30000, backgroundTaskId = null) {
    return new Promise((resolve, reject) => {
      const jobId = ++this.jobCounter;
      const workerTimeout = 24 * 60 * 60 * 1000;
      const job = {
        jobId, resolve, reject, startTime: Date.now(),
        backgroundTaskId,
        code, runtime, workingDirectory, timeout
      };

      if (this.shuttingDown) {
        return reject(new Error('Pool is shutting down'));
      }

      if (this.workers.length === 0) {
        return reject(new Error('No workers available'));
      }

      if (this.queue.length > 100) {
        return reject(new Error('Queue overflow - too many pending jobs'));
      }

      this.activeJobs.set(jobId, job);

      const worker = this.workers.find(w => w.isAvailable);
      if (!worker) { this.queue.push(job); return; }
      worker.isAvailable = false;

      const timer = setTimeout(() => {
        this.activeJobs.delete(jobId);
        this.backgroundJobs.set(jobId, job);
        if (backgroundTaskId) backgroundStore.startTask(backgroundTaskId);
        resolve({ backgroundTaskId, persisted: true });
      }, timeout);

      job.timer = timer;
      job.worker = worker.worker;

      try {
        worker.worker.postMessage({ jobId, code, runtime, workingDirectory, timeout: workerTimeout });
      } catch (err) {
        clearTimeout(timer);
        this.activeJobs.delete(jobId);
        worker.isAvailable = true;
        reject(new Error(`Failed to send to worker: ${err.message}`));
        this.processQueue();
      }
    });
  }

  processQueue() {
    while (this.queue.length > 0) {
      const worker = this.workers.find(w => w.isAvailable);
      if (!worker) break;
      const job = this.queue.shift();
      worker.isAvailable = false;

      const timeoutDuration = job.timeout || 30000;
      const workerTimeout = 24 * 60 * 60 * 1000;
      const timer = setTimeout(() => {
        this.activeJobs.delete(job.jobId);
        this.backgroundJobs.set(job.jobId, job);
        if (job.backgroundTaskId) backgroundStore.startTask(job.backgroundTaskId);
        if (job.resolve) job.resolve({ backgroundTaskId: job.backgroundTaskId, persisted: true });
      }, timeoutDuration);

      job.timer = timer;
      job.worker = worker.worker;
      try {
        worker.worker.postMessage({
          jobId: job.jobId, code: job.code,
          runtime: job.runtime, workingDirectory: job.workingDirectory,
          timeout: workerTimeout
        });
      } catch (err) {
        clearTimeout(timer);
        this.activeJobs.delete(job.jobId);
        worker.isAvailable = true;
        if (job.reject) job.reject(err);
      }
    }
  }

  async shutdown() {
    this.shuttingDown = true;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    for (const job of this.activeJobs.values()) {
      if (job.timer) clearTimeout(job.timer);
      try { job.reject(new Error('Pool shutting down')); } catch (e) {}
    }
    this.activeJobs.clear();
    for (const job of this.queue) {
      try { job.reject(new Error('Pool shutting down')); } catch (e) {}
    }
    this.queue = [];
    for (const job of this.backgroundJobs.values()) {
      if (job.timer) clearTimeout(job.timer);
      if (job.backgroundTaskId) backgroundStore.failTask(job.backgroundTaskId, new Error('Pool shutting down'));
      try { job.reject(new Error('Pool shutting down')); } catch (e) {}
    }
    this.backgroundJobs.clear();
    await Promise.all(this.workers.map(({ worker }) => worker.terminate().catch(() => {})));
    this.workers = [];
  }
}

export const globalPool = new WorkerPool(4);
