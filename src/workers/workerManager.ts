import type { WorkerTask, WorkerResult, OutlineResult } from './workerTypes';

// Optional: Dev-only lightweight logger
const DEBUG = import.meta.env?.DEV ?? false;
function logPerf(message: string, duration?: number) {
  if (DEBUG) {
    console.log(`[WorkerManager] ${message}${duration !== undefined ? ` in ${duration}ms` : ''}`);
  }
}

class WorkerManager {
  private worker: Worker | null = null;
  private jobIdCounter = 0;
  private pendingJobs = new Map<number, { resolve: (res: any) => void; reject: (err: Error) => void }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      this.worker = new Worker(new URL('./editor.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        const result = e.data;
        const job = this.pendingJobs.get(result.jobId);
        
        if (job) {
          this.pendingJobs.delete(result.jobId);
          if (result.error) {
            job.reject(new Error(result.error));
          } else {
            job.resolve(result);
          }
        }
      };

      this.worker.onerror = (e) => {
        console.error('[WorkerManager] Worker encountered an unhandled error:', e);
        // Reject all pending jobs
        this.rejectAllPending(new Error('Worker crashed or encountered an unhandled error.'));
        // Restart the worker to recover
        if (this.worker) {
          this.worker.terminate();
        }
        this.initWorker();
      };
    } catch (err) {
      console.error('[WorkerManager] Failed to initialize worker:', err);
    }
  }

  private rejectAllPending(error: Error) {
    this.pendingJobs.forEach((job) => job.reject(error));
    this.pendingJobs.clear();
  }

  private async dispatch<T extends WorkerResult>(task: Omit<WorkerTask, 'jobId'>): Promise<T> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const jobId = ++this.jobIdCounter;
    const fullTask: WorkerTask = { ...task, jobId } as WorkerTask;

    return new Promise<T>((resolve, reject) => {
      this.pendingJobs.set(jobId, { resolve, reject });
      try {
        logPerf(`Dispatching task ${task.type} (v${task.version})`);
        this.worker!.postMessage(fullTask);
      } catch (err) {
        this.pendingJobs.delete(jobId);
        reject(err);
      }
    });
  }

  /**
   * Dispatches an outline extraction task to the worker.
   */
  public async extractOutline(fileId: string, version: number, content: string): Promise<OutlineResult> {
    return this.dispatch<OutlineResult>({
      type: 'extract-outline',
      fileId,
      version,
      content,
    });
  }
  
  // Expose logging helper for components
  public log(msg: string, duration?: number) {
    logPerf(msg, duration);
  }
}

export const workerManager = new WorkerManager();
