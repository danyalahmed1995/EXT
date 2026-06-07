/**
 * Lightweight source-block indexer.
 * Splits raw markdown into discrete blocks by scanning for
 * blank lines, code fences (``` / ~~~), and display-math ($$).
 * No markdown-it parsing – just string scanning.
 */

export interface SourceBlock {
  id: number;
  type: 'heading' | 'paragraph' | 'code' | 'table' | 'math' | 'list' | 'quote' | 'hr' | 'other';
  source: string;
  lineCount: number;
  estimatedHeight: number;
  mathHeavy: boolean;
}

/* ── Height estimation constants ────────────────── */
const LINE_PX = 24;
const CODE_LINE_PX = 20;
const TABLE_ROW_PX = 30;
const MATH_LINE_PX = 40;
const HEADING_PX = 50;
const HR_PX = 20;
const MIN_BLOCK_PX = 16;

/**
 * Maximum lines per block.  Blocks exceeding this are split into
 * sub-blocks so that no single worker render + DOMPurify call is
 * catastrophically large (prevents OOM on huge tables).
 */
const MAX_BLOCK_LINES = 50;

/* ── Block-type detection ───────────────────────── */
function detectType(firstLine: string): SourceBlock['type'] {
  const t = firstLine.trimStart();
  if (t.startsWith('#')) return 'heading';
  if (t.startsWith('```') || t.startsWith('~~~')) return 'code';
  if (t === '$$') return 'math';
  if (t.startsWith('|')) return 'table';
  if (/^[-*+]\s/.test(t) || /^\d+[.)]\s/.test(t)) return 'list';
  if (t.startsWith('>')) return 'quote';
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) return 'hr';
  return 'paragraph';
}

function estimateHeight(type: SourceBlock['type'], lines: number, mathHeavy: boolean): number {
  switch (type) {
    case 'heading': return HEADING_PX;
    case 'code':    return Math.max(MIN_BLOCK_PX, lines * CODE_LINE_PX + 24);
    case 'table':   return Math.max(MIN_BLOCK_PX, lines * TABLE_ROW_PX);
    case 'math':    return Math.max(MIN_BLOCK_PX, lines * MATH_LINE_PX);
    case 'hr':      return HR_PX;
    default:        return Math.max(MIN_BLOCK_PX, lines * (mathHeavy ? 36 : LINE_PX));
  }
}

/* ── Main indexer ───────────────────────────────── */
export function indexBlocks(content: string): SourceBlock[] {
  const lines = content.split(/\r?\n/);
  const blocks: SourceBlock[] = [];
  let buf: string[] = [];

  let inCodeFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  let inMathBlock = false;

  const pushBlock = (lines: string[]) => {
    const source = lines.join('\n');
    const type = detectType(lines[0]);
    const dollarCount = (source.match(/\$/g) || []).length;
    const mathHeavy = dollarCount > 4;

    blocks.push({
      id: blocks.length,
      type,
      source,
      lineCount: lines.length,
      estimatedHeight: estimateHeight(type, lines.length, mathHeavy),
      mathHeavy,
    });
  };

  const emit = () => {
    // Trim trailing blank lines from buffer
    while (buf.length > 0 && buf[buf.length - 1].trim() === '') buf.pop();
    if (buf.length === 0) return;

    // If the block is small enough, emit directly
    if (buf.length <= MAX_BLOCK_LINES) {
      pushBlock(buf);
      buf = [];
      return;
    }

    // Oversized block – split into sub-blocks of MAX_BLOCK_LINES
    const type = detectType(buf[0]);

    if (type === 'table') {
      // For tables, preserve the header (first 2 lines: header + separator)
      const headerLines = buf.slice(0, 2);
      const dataStart = 2;
      for (let s = dataStart; s < buf.length; s += MAX_BLOCK_LINES) {
        const end = Math.min(s + MAX_BLOCK_LINES, buf.length);
        pushBlock([...headerLines, ...buf.slice(s, end)]);
      }
    } else {
      // Generic split (paragraphs, lists, etc.)
      for (let s = 0; s < buf.length; s += MAX_BLOCK_LINES) {
        const end = Math.min(s + MAX_BLOCK_LINES, buf.length);
        pushBlock(buf.slice(s, end));
      }
    }

    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    /* ── Code-fence handling ───────────────────── */
    if (!inMathBlock) {
      const m = trimmed.match(/^(`{3,}|~{3,})/);
      if (m) {
        if (!inCodeFence) {
          emit();                       // flush prior block
          inCodeFence = true;
          fenceChar = m[1][0];
          fenceLen = m[1].length;
          buf = [line];
          continue;
        }
        // Check for closing fence
        if (trimmed[0] === fenceChar) {
          const closingRun = trimmed.match(/^[`~]+/);
          if (closingRun && closingRun[0].length >= fenceLen && /^[`~]+\s*$/.test(trimmed)) {
            buf.push(line);
            inCodeFence = false;
            emit();
            continue;
          }
        }
      }
    }

    if (inCodeFence) { buf.push(line); continue; }

    /* ── Math-block handling ──────────────────── */
    if (trimmed === '$$') {
      if (!inMathBlock) {
        emit();
        inMathBlock = true;
        buf = [line];
      } else {
        buf.push(line);
        inMathBlock = false;
        emit();
      }
      continue;
    }
    if (inMathBlock) { buf.push(line); continue; }

    /* ── Blank-line boundary ─────────────────── */
    if (trimmed === '') {
      emit();
      continue;
    }

    /* ── Normal content line ─────────────────── */
    buf.push(line);
  }

  // Flush anything remaining (e.g. unclosed fences)
  emit();

  return blocks;
}
