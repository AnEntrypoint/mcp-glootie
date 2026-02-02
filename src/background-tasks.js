export class BackgroundTaskStore {
  constructor() {
    this.tasks = new Map();
    this.taskCounter = 0;
  }

  createTask(code, runtime, workingDirectory) {
    const taskId = ++this.taskCounter;
    this.tasks.set(taskId, {
      id: taskId,
      code,
      runtime,
      workingDirectory,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      status: 'pending'
    });
    return taskId;
  }

  startTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.startedAt = Date.now();
      task.status = 'running';
    }
  }

  completeTask(taskId, result) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completedAt = Date.now();
      task.result = result;
      task.status = 'completed';
    }
  }

  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completedAt = Date.now();
      task.result = { error: error.message };
      task.status = 'failed';
    }
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  deleteTask(taskId) {
    this.tasks.delete(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values());
  }
}

export const backgroundStore = new BackgroundTaskStore();
