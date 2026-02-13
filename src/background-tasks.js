export class BackgroundTaskStore {
  constructor() {
    this.tasks = new Map();
    this.taskCounter = 0;
    this.maxAge = 30 * 60 * 1000;
    this.maxTasks = 1000;
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
      completedAt: null, result: null, status: 'pending'
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

  updateOutput(taskId, stdout, stderr) {
    const task = this.tasks.get(taskId);
    if (task && (task.status === 'running' || task.status === 'pending')) {
      if (!task.result) task.result = {};
      task.result.stdout = stdout;
      task.result.stderr = stderr;
    }
  }

  getTask(taskId) { return this.tasks.get(taskId); }
  deleteTask(taskId) { this.tasks.delete(taskId); }
  getAllTasks() { return Array.from(this.tasks.values()); }
}

export const backgroundStore = new BackgroundTaskStore();
