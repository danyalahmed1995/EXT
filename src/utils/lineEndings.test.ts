import { describe, expect, it } from 'vitest';
import { convertLineEndings, detectLineEnding, prepareContentForSave } from './lineEndings';

describe('lineEndings', () => {
  it('detects LF, CRLF, Mixed, and single-line defaults', () => {
    expect(detectLineEnding('one\ntwo\n')).toBe('LF');
    expect(detectLineEnding('one\r\ntwo\r\n')).toBe('CRLF');
    expect(detectLineEnding('one\r\ntwo\nthree')).toBe('Mixed');
    expect(detectLineEnding('one')).toBe('LF');
  });

  it('converts line endings explicitly', () => {
    expect(convertLineEndings('one\r\ntwo\nthree\r', 'LF')).toBe('one\ntwo\nthree\n');
    expect(convertLineEndings('one\r\ntwo\n', 'CRLF')).toBe('one\r\ntwo\r\n');
  });

  it('prepares content for save without converting Mixed', () => {
    expect(prepareContentForSave('one\ntwo\n', 'CRLF')).toBe('one\r\ntwo\r\n');
    expect(prepareContentForSave('one\r\ntwo\n', 'Mixed')).toBe('one\r\ntwo\n');
  });
});
