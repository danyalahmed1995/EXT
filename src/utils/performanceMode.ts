export const LARGE_DOC_THRESHOLD = 250_000;
export const HUGE_DOC_THRESHOLD = 1_000_000;

export type PerfTier = 'normal' | 'large' | 'huge';

export function getPerfTier(contentLength: number): PerfTier {
  if (contentLength >= HUGE_DOC_THRESHOLD) return 'huge';
  if (contentLength >= LARGE_DOC_THRESHOLD) return 'large';
  return 'normal';
}
