import type { FileItem } from '../types';

export const NORMAL_FILE_LIMIT_BYTES = 20 * 1024 * 1024;
export const LARGE_FILE_MODE_LIMIT_BYTES = 100 * 1024 * 1024;
export const ONE_GIB_BYTES = 1024 * 1024 * 1024;

export type FileOpenMode = 'normal' | 'large-warning' | 'large-file';

export interface LargeFileMetadata {
  name: string;
  size: number;
  path: string;
  extension: string;
  modifiedAt?: string;
  openMode: FileOpenMode;
}

export interface LargeFilePatch {
  id: string;
  start: number;
  end: number;
  text: string;
  createdAt: number;
}

export interface LargeFileChunkState {
  text: string;
  originalText: string;
  offset: number;
  endOffset: number;
  bytesRead: number;
  nextOffset: number;
  isEof: boolean;
  beginsMidLine?: boolean;
  endsMidLine?: boolean;
  newlineStyle?: 'LF' | 'CRLF' | 'Mixed' | 'Unknown';
  loadedAt: number;
}

export interface LargeFileSearchResult {
  line: number;
  byteOffset: number;
  preview: string;
}

export interface LargeFileLineCheckpoint {
  line: number;
  offset: number;
}

export interface LargeFileLineIndexState {
  checkpoints: LargeFileLineCheckpoint[];
  indexedBytes: number;
  totalLines?: number;
  isComplete: boolean;
  isIndexing: boolean;
}

export interface LargeFileSessionState {
  currentOffset: number;
  chunk?: LargeFileChunkState;
  patches: LargeFilePatch[];
  searchQuery?: string;
  searchResults?: LargeFileSearchResult[];
  lineIndex?: LargeFileLineIndexState;
  scannedBytes?: number;
  status?: string;
}

export function getFileOpenMode(size: number): FileOpenMode {
  if (size > LARGE_FILE_MODE_LIMIT_BYTES) return 'large-file';
  if (size >= NORMAL_FILE_LIMIT_BYTES) return 'large-warning';
  return 'normal';
}

export function isLargeFileMode(size: number): boolean {
  return getFileOpenMode(size) === 'large-file';
}

export function createLargeFileMetadata(file: FileItem): LargeFileMetadata {
  return {
    name: file.name,
    size: file.size,
    path: file.absolutePath,
    extension: file.extension,
    modifiedAt: file.modifiedAt,
    openMode: getFileOpenMode(file.size),
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
