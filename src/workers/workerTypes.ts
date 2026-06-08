import type { Heading } from '../utils/outlineParser';

export type WorkerTaskType = 'extract-outline';

export interface BaseWorkerTask {
  jobId: number;
  fileId: string;
  version: number;
  type: WorkerTaskType;
}

export interface OutlineTask extends BaseWorkerTask {
  type: 'extract-outline';
  content: string;
}

export type WorkerTask = OutlineTask;

export interface BaseWorkerResult {
  jobId: number;
  fileId: string;
  version: number;
  type: WorkerTaskType;
  error?: string;
  durationMs?: number;
}

export interface OutlineResult extends BaseWorkerResult {
  type: 'extract-outline';
  headings: Heading[];
}

export type WorkerResult = OutlineResult;
