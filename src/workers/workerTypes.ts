import type { Heading } from '../utils/outlineParser';

export type WorkerTaskType = 'extract-outline' | 'analyze-markdown-range';

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

export interface RangeTask extends BaseWorkerTask {
  type: 'analyze-markdown-range';
  text: string;
  from: number;
  to: number;
}

export type WorkerTask = OutlineTask | RangeTask;

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

export interface RangeResult extends BaseWorkerResult {
  type: 'analyze-markdown-range';
  // Fast local metadata extracted from the range.
  // For example, local headings within the visible buffer.
  headings: Heading[];
}

export type WorkerResult = OutlineResult | RangeResult;
