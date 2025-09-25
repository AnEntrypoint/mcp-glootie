import { EventEmitter } from 'events';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// Job status types
export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
};

// Job priority levels
export const JobPriority = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
};

export class Job extends EventEmitter {
  constructor({
    id = uuidv4(),
    type,
    name,
    description = '',
    parameters = {},
    priority = JobPriority.NORMAL,
    timeout = 30 * 60 * 1000, // 30 minutes default
    createdAt = new Date(),
    createdBy = 'agent'
  } = {}) {
    super();

    this.id = id;
    this.type = type;
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this.priority = priority;
    this.timeout = timeout;
    this.createdAt = createdAt;
    this.createdBy = createdBy;

    this.status = JobStatus.PENDING;
    this.startedAt = null;
    this.completedAt = null;
    this.progress = 0;
    this.result = null;
    this.error = null;
    this.output = [];
    this.warnings = [];

    // Timeout handling
    this.timeoutTimer = null;
    this.executionPromise = null;
    this.executionResolve = null;
    this.executionReject = null;
  }

  start() {
    this.status = JobStatus.RUNNING;
    this.startedAt = new Date();
    this.setupTimeout();
    this.emit('started', this);
  }

  updateProgress(progress, message = '') {
    this.progress = Math.max(0, Math.min(100, progress));
    if (message) {
      this.addOutput(`Progress: ${this.progress}% - ${message}`);
    }
    this.emit('progress', { job: this, progress, message });
  }

  addOutput(output) {
    const timestamp = new Date().toISOString();
    this.output.push({ timestamp, message: String(output) });
    this.emit('output', { job: this, output: { timestamp, message: String(output) } });
  }

  addWarning(warning) {
    const timestamp = new Date().toISOString();
    this.warnings.push({ timestamp, message: String(warning) });
    this.emit('warning', { job: this, warning: { timestamp, message: String(warning) } });
  }

  complete(result = null) {
    this.clearTimeout();
    this.status = JobStatus.COMPLETED;
    this.completedAt = new Date();
    this.progress = 100;
    this.result = result;

    if (this.executionResolve) {
      this.executionResolve(result);
    }

    this.emit('completed', this);
  }

  fail(error) {
    this.clearTimeout();
    this.status = JobStatus.FAILED;
    this.completedAt = new Date();
    this.error = error;

    if (this.executionReject) {
      this.executionReject(error);
    }

    this.emit('failed', this);
  }

  cancel() {
    this.clearTimeout();
    this.status = JobStatus.CANCELLED;
    this.completedAt = new Date();

    if (this.executionReject) {
      this.executionReject(new Error('Job cancelled'));
    }

    this.emit('cancelled', this);
  }

  timeout() {
    this.status = JobStatus.TIMEOUT;
    this.completedAt = new Date();
    this.error = new Error('Job timed out');

    if (this.executionReject) {
      this.executionReject(this.error);
    }

    this.emit('timeout', this);
  }

  setupTimeout() {
    this.timeoutTimer = setTimeout(() => {
      this.timeout();
    }, this.timeout);
  }

  clearTimeout() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  getExecutionPromise() {
    if (!this.executionPromise) {
      this.executionPromise = new Promise((resolve, reject) => {
        this.executionResolve = resolve;
        this.executionReject = reject;
      });
    }
    return this.executionPromise;
  }

  getDuration() {
    if (this.startedAt) {
      const end = this.completedAt || new Date();
      return end.getTime() - this.startedAt.getTime();
    }
    return 0;
  }

  getETA() {
    if (this.progress > 0 && this.startedAt) {
      const elapsed = this.getDuration();
      const totalEstimated = (elapsed / this.progress) * 100;
      const remaining = totalEstimated - elapsed;
      return Math.max(0, remaining);
    }
    return null;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      status: this.status,
      priority: this.priority,
      progress: this.progress,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      duration: this.getDuration(),
      timeout: this.timeout,
      eta: this.getETA(),
      createdBy: this.createdBy,
      error: this.error?.message,
      result: this.result,
      outputCount: this.output.length,
      warningCount: this.warnings.length,
      hasWarnings: this.warnings.length > 0
    };
  }

  getDetailedOutput() {
    return {
      ...this.toJSON(),
      output: this.output.slice(-10), // Last 10 output entries
      warnings: this.warnings.slice(-5), // Last 5 warnings
      parameters: this.parameters
    };
  }
}

export class JobManager extends EventEmitter {
  constructor(storageDir = './job-storage') {
    super();
    this.jobs = new Map();
    this.storageDir = storageDir;
    this.ensureStorageDir();
    this.loadJobsFromStorage();

    // Start cleanup process
    this.startCleanupProcess();
  }

  ensureStorageDir() {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getJobPath(jobId) {
    return join(this.storageDir, `${jobId}.json`);
  }

  saveJobToStorage(job) {
    try {
      const jobPath = this.getJobPath(job.id);
      writeFileSync(jobPath, JSON.stringify(job.toJSON(), null, 2));
    } catch (error) {
      console.error(`Failed to save job ${job.id} to storage:`, error);
    }
  }

  loadJobFromStorage(jobId) {
    try {
      const jobPath = this.getJobPath(jobId);
      if (existsSync(jobPath)) {
        const data = readFileSync(jobPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Failed to load job ${jobId} from storage:`, error);
    }
    return null;
  }

  loadJobsFromStorage() {
    // In a real implementation, you'd scan the storage directory
    // For now, we'll start fresh
  }

  deleteJobFromStorage(jobId) {
    try {
      const jobPath = this.getJobPath(jobId);
      if (existsSync(jobPath)) {
        unlinkSync(jobPath);
      }
    } catch (error) {
      console.error(`Failed to delete job ${jobId} from storage:`, error);
    }
  }

  createJob(options) {
    const job = new Job(options);

    // Set up event listeners for persistence
    job.on('started', (job) => this.saveJobToStorage(job));
    job.on('progress', ({ job }) => this.saveJobToStorage(job));
    job.on('completed', (job) => {
      this.saveJobToStorage(job);
      this.emit('jobCompleted', job);
    });
    job.on('failed', (job) => {
      this.saveJobToStorage(job);
      this.emit('jobFailed', job);
    });
    job.on('cancelled', (job) => {
      this.saveJobToStorage(job);
      this.emit('jobCancelled', job);
    });
    job.on('timeout', (job) => {
      this.saveJobToStorage(job);
      this.emit('jobTimeout', job);
    });

    this.jobs.set(job.id, job);
    this.emit('jobCreated', job);

    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  getJobsByStatus(status) {
    return this.getAllJobs().filter(job => job.status === status);
  }

  getJobsByType(type) {
    return this.getAllJobs().filter(job => job.type === type);
  }

  cancelJob(jobId) {
    const job = this.getJob(jobId);
    if (job && [JobStatus.PENDING, JobStatus.RUNNING].includes(job.status)) {
      job.cancel();
      return true;
    }
    return false;
  }

  deleteJob(jobId) {
    const job = this.getJob(jobId);
    if (job && [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.TIMEOUT].includes(job.status)) {
      this.jobs.delete(jobId);
      this.deleteJobFromStorage(jobId);
      return true;
    }
    return false;
  }

  startCleanupProcess() {
    // Clean up completed jobs older than 1 hour every 5 minutes
    setInterval(() => {
      this.cleanupOldJobs();
    }, 5 * 60 * 1000);
  }

  cleanupOldJobs() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const jobsToDelete = this.getAllJobs().filter(job =>
      job.completedAt &&
      new Date(job.completedAt) < oneHourAgo &&
      [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.TIMEOUT].includes(job.status)
    );

    jobsToDelete.forEach(job => {
      this.deleteJob(job.id);
    });

    if (jobsToDelete.length > 0) {
      console.log(`Cleaned up ${jobsToDelete.length} old jobs`);
    }
  }

  getStats() {
    const allJobs = this.getAllJobs();
    return {
      total: allJobs.length,
      pending: allJobs.filter(j => j.status === JobStatus.PENDING).length,
      running: allJobs.filter(j => j.status === JobStatus.RUNNING).length,
      completed: allJobs.filter(j => j.status === JobStatus.COMPLETED).length,
      failed: allJobs.filter(j => j.status === JobStatus.FAILED).length,
      cancelled: allJobs.filter(j => j.status === JobStatus.CANCELLED).length,
      timeout: allJobs.filter(j => j.status === JobStatus.TIMEOUT).length
    };
  }

  shutdown() {
    // Cancel all running jobs
    this.getJobsByStatus(JobStatus.RUNNING).forEach(job => {
      job.cancel();
    });

    // Clear all jobs
    this.jobs.clear();
  }
}

// Global job manager instance
export const jobManager = new JobManager();