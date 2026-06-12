import type { FileItem, LargeFileSettings, LargeFileThresholdPreset } from '../types';

export const NORMAL_FILE_LIMIT_BYTES = 20 * 1024 * 1024;
export const LARGE_FILE_MODE_LIMIT_BYTES = 100 * 1024 * 1024;
export const NORMAL_EDITOR_HARD_LIMIT_BYTES = 100 * 1024 * 1024;
export const ONE_GIB_BYTES = 1024 * 1024 * 1024;
export const MB_BYTES = 1024 * 1024;

export const DEFAULT_LARGE_FILE_SETTINGS: LargeFileSettings = {
  autoEnable: true,
  thresholdPreset: '100mb',
  customThresholdMb: 100,
  askBeforeOpening: false,
  showDetailsPanel: true,
  allowNormalEditor: false,
};

export const LARGE_FILE_THRESHOLD_OPTIONS: Array<{ value: LargeFileThresholdPreset; label: string; bytes?: number }> = [
  { value: '20mb', label: '20 MB', bytes: 20 * MB_BYTES },
  { value: '50mb', label: '50 MB', bytes: 50 * MB_BYTES },
  { value: '100mb', label: '100 MB', bytes: 100 * MB_BYTES },
  { value: '250mb', label: '250 MB', bytes: 250 * MB_BYTES },
  { value: '500mb', label: '500 MB', bytes: 500 * MB_BYTES },
  { value: 'custom', label: 'Custom' },
];

export const SIMPLE_LARGE_FILE_THRESHOLD_OPTIONS = LARGE_FILE_THRESHOLD_OPTIONS.filter(
  (option) => option.value !== 'custom',
);

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
  fileSize?: number;
  modifiedAt?: string;
  chunk?: LargeFileChunkState;
  chunkCache?: LargeFileChunkState[];
  patches: LargeFilePatch[];
  searchQuery?: string;
  searchResults?: LargeFileSearchResult[];
  lineIndex?: LargeFileLineIndexState;
  scannedBytes?: number;
  status?: string;
}

export function normalizeLargeFileSettings(settings?: Partial<LargeFileSettings>): LargeFileSettings {
  const thresholdPreset = settings?.thresholdPreset && SIMPLE_LARGE_FILE_THRESHOLD_OPTIONS.some((option) => option.value === settings.thresholdPreset)
    ? settings.thresholdPreset
    : DEFAULT_LARGE_FILE_SETTINGS.thresholdPreset;

  return {
    ...DEFAULT_LARGE_FILE_SETTINGS,
    ...settings,
    autoEnable: settings?.autoEnable !== false,
    askBeforeOpening: false,
    allowNormalEditor: false,
    showDetailsPanel: settings?.showDetailsPanel ?? DEFAULT_LARGE_FILE_SETTINGS.showDetailsPanel,
    thresholdPreset,
    customThresholdMb: Number.isFinite(settings?.customThresholdMb)
      ? Math.max(1, settings?.customThresholdMb ?? DEFAULT_LARGE_FILE_SETTINGS.customThresholdMb)
      : DEFAULT_LARGE_FILE_SETTINGS.customThresholdMb,
  };
}

export function getLargeFileThresholdBytes(settings?: Partial<LargeFileSettings>): number {
  const normalized = normalizeLargeFileSettings(settings);
  if (normalized.thresholdPreset === 'custom') {
    return Math.max(1, Math.floor(normalized.customThresholdMb)) * MB_BYTES;
  }
  return LARGE_FILE_THRESHOLD_OPTIONS.find((option) => option.value === normalized.thresholdPreset)?.bytes
    ?? LARGE_FILE_MODE_LIMIT_BYTES;
}

export function shouldUseLargeFileEngine(size: number, settings?: Partial<LargeFileSettings>): boolean {
  const normalized = normalizeLargeFileSettings(settings);
  if (!normalized.autoEnable) return size > NORMAL_EDITOR_HARD_LIMIT_BYTES || size >= ONE_GIB_BYTES;
  return size > getLargeFileThresholdBytes(normalized)
    || size > NORMAL_EDITOR_HARD_LIMIT_BYTES
    || size >= ONE_GIB_BYTES;
}

export function canUseNormalEditorForFile(size: number): boolean {
  return size <= NORMAL_EDITOR_HARD_LIMIT_BYTES;
}

export function getFileOpenMode(size: number, settings?: Partial<LargeFileSettings>): FileOpenMode {
  if (shouldUseLargeFileEngine(size, settings)) return 'large-file';
  if (size >= NORMAL_FILE_LIMIT_BYTES) return 'large-warning';
  return 'normal';
}

export function isLargeFileMode(size: number, settings?: Partial<LargeFileSettings>): boolean {
  return getFileOpenMode(size, settings) === 'large-file';
}

export function createLargeFileMetadata(file: FileItem, settings?: Partial<LargeFileSettings>): LargeFileMetadata {
  return {
    name: file.name,
    size: file.size,
    path: file.absolutePath,
    extension: file.extension,
    modifiedAt: file.modifiedAt,
    openMode: getFileOpenMode(file.size, settings),
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
