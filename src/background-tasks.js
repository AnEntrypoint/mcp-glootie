export class BackgroundTaskStore {
  constructor() {
    this.tasks = new Map();
    this.taskCounter = 0;
    this.maxAge = 30 * 60 * 1000;
    this.maxTasks = 1000;
    this.maxOutputSize = 100 * 1024;
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [id, task] of this.tasks) {
      if ((task.status === 'completed' || task.status === 'failed') &&
          task.completedAt && (now - task.completedAt > this.maxAge)) {
        this.tasks.delete(id);
      }
    }
    if (this.tasks.size > this.maxTasks) {
      const expired = [...this.tasks.entries()]
        .filter(([, t]) => t.status === 'completed' || t.status === 'failed')
        .sort((a, b) => a[1].completedAt - b[1].completedAt);
      for (const [id] of expired) {
        this.tasks.delete(id);
        if (this.tasks.size <= this.maxTasks) break;
      }
    }
  }

  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const [, task] of this.tasks) {
      if (task.status === 'running' || task.status === 'pending') {
        task.completedAt = Date.now();
        task.result = { error: 'Process shutting down' };
        task.status = 'failed';
      }
    }
  }

  createTask(code, runtime, workingDirectory) {
    const taskId = ++this.taskCounter;
    this.tasks.set(taskId, {
      id: taskId, code, runtime, workingDirectory,
      createdAt: Date.now(), startedAt: null,
      completedAt: null, result: null, status: 'pending',
      outputLog: []
    });
    return taskId;
  }

  startTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) { task.startedAt = Date.now(); task.status = 'running'; }
  }

  completeTask(taskId, result) {
    const task = this.tasks.get(taskId);
    if (task) { task.completedAt = Date.now(); task.result = result; task.status = 'completed'; }
  }

  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (task) { task.completedAt = Date.now(); task.result = { error: error.message }; task.status = 'failed'; }
  }

  appendOutput(taskId, type, data) {
    const task = this.tasks.get(taskId);
    if (!task || (task.status !== 'running' && task.status !== 'pending')) return;
    const timestamp = Date.now();
    task.outputLog.push({ t: timestamp, s: type, d: data });
    const totalLen = task.outputLog.reduce((sum, e) => sum + e.d.length, 0);
    if (totalLen > this.maxOutputSize) {
      while (task.outputLog.length > 1 && 
             task.outputLog.reduce((sum, e) => sum + e.d.length, 0) > this.maxOutputSize * 0.5) {
        task.outputLog.shift();
      }
    }
  }

  getAndClearOutput(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    const log = task.outputLog;
    task.outputLog = [];
    return log;
  }

  getTask(taskId) { return this.tasks.get(taskId); }
  deleteTask(taskId) { this.tasks.delete(taskId); }
  getAllTasks() { return Array.from(this.tasks.values()); }
}

export const backgroundStore = new BackgroundTaskStore();
