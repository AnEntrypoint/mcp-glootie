import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WorkerPool extends EventEmitter {
  constructor(poolSize = 4) {
    super();
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.activeJobs = new Map();
    this.jobCounter = 0;
    this.shuttingDown = false;

    for (let i = 0; i < poolSize; i++) {
      this.addWorker();
    }
  }

  addWorker() {
    try {
      const worker = new Worker(path.join(__dirname, 'isolation-worker.js'));
      let isAvailable = true;

      worker.on('message', (msg) => {
        this.handleWorkerMessage(worker, msg);
      });

      worker.on('error', (err) => {
        isAvailable = false;
        this.emit('workerError', err);
        this.removeWorker(worker);
      });

      worker.on('exit', () => {
        isAvailable = false;
        this.removeWorker(worker);
      });

      this.workers.push({ worker, isAvailable });
    } catch (err) {
      this.emit('poolError', new Error(`Failed to create worker: ${err.message}`));
    }
  }

  removeWorker(worker) {
    const index = this.workers.findIndex(w => w.worker === worker);
    if (index !== -1) {
      const item = this.workers[index];
      this.workers.splice(index, 1);
      try {
        item.worker.terminate();
      } catch (e) {}

      if (!this.shuttingDown && this.workers.length < this.poolSize) {
        this.addWorker();
      }
    }
  }

  handleWorkerMessage(worker, msg) {
    const { jobId, type, error, result, stdout, stderr, exitCode } = msg;

    if (!jobId || !this.activeJobs.has(jobId)) return;

    const job = this.activeJobs.get(jobId);
    const workerItem = this.workers.find(w => w.worker === worker);

    if (type === 'complete') {
      this.activeJobs.delete(jobId);
      if (workerItem) workerItem.isAvailable = true;

      job.resolve({
        success: error ? false : exitCode === 0,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: exitCode || 1,
        executionTimeMs: Date.now() - job.startTime,
        error: error ? new Error(error) : null
      });

      this.processQueue();
    } else if (type === 'error') {
      this.activeJobs.delete(jobId);
      if (workerItem) workerItem.isAvailable = true;

      job.reject(new Error(error || 'Worker error'));
      this.processQueue();
    }
  }

  async execute(code, runtime, workingDirectory, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const jobId = ++this.jobCounter;
      const job = { jobId, resolve, reject, startTime: Date.now() };

      this.activeJobs.set(jobId, job);

      const executeJob = () => {
        const worker = this.workers.find(w => w.isAvailable);
        if (!worker) {
          this.queue.push(job);
          return;
        }

        worker.isAvailable = false;

        const timer = setTimeout(() => {
          this.activeJobs.delete(jobId);
          worker.isAvailable = true;
          reject(new Error(`Execution timeout after ${timeout}ms`));
          this.processQueue();
        }, timeout);

        job.timer = timer;
        job.worker = worker.worker;

        try {
          worker.worker.postMessage({
            jobId,
            code,
            runtime,
            workingDirectory,
            timeout
          });
        } catch (err) {
          clearTimeout(timer);
          this.activeJobs.delete(jobId);
          worker.isAvailable = true;
          reject(new Error(`Failed to send to worker: ${err.message}`));
          this.processQueue();
        }
      };

      executeJob();
    });
  }

  processQueue() {
    while (this.queue.length > 0) {
      const worker = this.workers.find(w => w.isAvailable);
      if (!worker) break;

      const job = this.queue.shift();
      worker.isAvailable = false;

      const timer = setTimeout(() => {
        this.activeJobs.delete(job.jobId);
        worker.isAvailable = true;
        job.reject(new Error('Execution timeout'));
        this.processQueue();
      }, 30000);

      job.timer = timer;
      job.worker = worker.worker;

      try {
        worker.worker.postMessage({
          jobId: job.jobId,
          code: job.code,
          runtime: job.runtime,
          workingDirectory: job.workingDirectory
        });
      } catch (err) {
        clearTimeout(timer);
        this.activeJobs.delete(job.jobId);
        worker.isAvailable = true;
        job.reject(err);
      }
    }
  }

  async shutdown() {
    this.shuttingDown = true;

    for (const { jobId } of this.activeJobs.values()) {
      const job = this.activeJobs.get(jobId);
      if (job && job.timer) clearTimeout(job.timer);
    }

    this.activeJobs.clear();
    this.queue = [];

    await Promise.all(
      this.workers.map(({ worker }) =>
        new Promise((resolve) => {
          try {
            worker.terminate();
          } catch (e) {}
          resolve();
        })
      )
    );

    this.workers = [];
  }
}

export const globalPool = new WorkerPool(4);
