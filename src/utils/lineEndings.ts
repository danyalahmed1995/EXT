export type LineEnding = 'LF' | 'CRLF' | 'Mixed';
export type ConvertibleLineEnding = Exclude<LineEnding, 'Mixed'>;

export function detectLineEnding(text: string): LineEnding {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const normalized = text.replace(/\r\n/g, '');
  const lf = (normalized.match(/\n/g) ?? []).length;
  const cr = (normalized.match(/\r/g) ?? []).length;

  if ((crlf > 0 && (lf > 0 || cr > 0)) || (lf > 0 && cr > 0)) return 'Mixed';
  if (crlf > 0) return 'CRLF';
  return 'LF';
}

export function convertLineEndings(text: string, target: ConvertibleLineEnding): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return target === 'CRLF' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

export function prepareContentForSave(text: string, lineEnding: LineEnding | undefined): string {
  if (lineEnding === 'CRLF') return convertLineEndings(text, 'CRLF');
  if (lineEnding === 'LF') return convertLineEndings(text, 'LF');
  return text;
}
