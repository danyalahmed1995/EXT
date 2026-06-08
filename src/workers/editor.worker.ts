/// <reference lib="webworker" />
import type { WorkerTask, OutlineResult } from './workerTypes';
import { extractOutlineSync } from '../utils/outlineParser';

self.onmessage = (e: MessageEvent<WorkerTask>) => {
  const task = e.data;
  const start = performance.now();

  try {
    if (task.type === 'extract-outline') {
      const headings = extractOutlineSync(task.content);
      
      const result: OutlineResult = {
        jobId: task.jobId,
        fileId: task.fileId,
        version: task.version,
        type: 'extract-outline',
        headings,
        durationMs: Math.round(performance.now() - start),
      };

      self.postMessage(result);
    }
  } catch (err: any) {
    self.postMessage({
      jobId: task.jobId,
      fileId: task.fileId,
      version: task.version,
      type: task.type,
      error: err.message || 'Unknown worker error',
    });
  }
};
