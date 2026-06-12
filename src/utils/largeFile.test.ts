import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LARGE_FILE_SETTINGS,
  getLargeFileThresholdBytes,
  normalizeLargeFileSettings,
  shouldUseLargeFileEngine,
} from './largeFile';

describe('large file settings migration', () => {
  it('falls back to safe defaults when settings are missing', () => {
    expect(normalizeLargeFileSettings(undefined)).toEqual(DEFAULT_LARGE_FILE_SETTINGS);
  });

  it('migrates removed custom threshold settings back to 100 MB', () => {
    const migrated = normalizeLargeFileSettings({
      thresholdPreset: 'custom',
      customThresholdMb: 2048,
      allowNormalEditor: true,
      askBeforeOpening: true,
    });

    expect(migrated.thresholdPreset).toBe('100mb');
    expect(migrated.allowNormalEditor).toBe(false);
    expect(migrated.askBeforeOpening).toBe(false);
    expect(getLargeFileThresholdBytes(migrated)).toBe(getLargeFileThresholdBytes(DEFAULT_LARGE_FILE_SETTINGS));
  });

  it('always protects known-crashy file sizes even when safe mode is disabled', () => {
    expect(shouldUseLargeFileEngine(1024 * 1024 * 1024, { autoEnable: false })).toBe(true);
  });
});
