/**
 * Lightweight source-block indexer – pure JS copy for the benchmark runner.
 * Mirrors src/utils/blockIndexer.ts logic without TypeScript.
 */

const LINE_PX = 24;
const MAX_BLOCK_LINES = 50;

function detectType(firstLine) {
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

function estimateHeight(type, lines, mathHeavy) {
  switch (type) {
    case 'heading': return 50;
    case 'code':    return Math.max(16, lines * 20 + 24);
    case 'table':   return Math.max(16, lines * 30);
    case 'math':    return Math.max(16, lines * 40);
    case 'hr':      return 20;
    default:        return Math.max(16, lines * (mathHeavy ? 36 : LINE_PX));
  }
}

function pushBlock(blocks, lines) {
  const source = lines.join('\n');
  const type = detectType(lines[0]);
  const dollarCount = (source.match(/\$/g) || []).length;
  const mathHeavy = dollarCount > 4;
  blocks.push({
    id: blocks.length, type, source,
    lineCount: lines.length,
    estimatedHeight: estimateHeight(type, lines.length, mathHeavy),
    mathHeavy,
  });
}

export function indexBlocks(content) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let buf = [];
  let inCodeFence = false, fenceChar = '', fenceLen = 0;
  let inMathBlock = false;

  const emit = () => {
    while (buf.length > 0 && buf[buf.length - 1].trim() === '') buf.pop();
    if (buf.length === 0) return;

    if (buf.length <= MAX_BLOCK_LINES) {
      pushBlock(blocks, buf);
      buf = [];
      return;
    }

    // Oversized – split
    const type = detectType(buf[0]);
    if (type === 'table') {
      const hdr = buf.slice(0, 2);
      for (let s = 2; s < buf.length; s += MAX_BLOCK_LINES) {
        pushBlock(blocks, [...hdr, ...buf.slice(s, Math.min(s + MAX_BLOCK_LINES, buf.length))]);
      }
    } else {
      for (let s = 0; s < buf.length; s += MAX_BLOCK_LINES) {
        pushBlock(blocks, buf.slice(s, Math.min(s + MAX_BLOCK_LINES, buf.length)));
      }
    }
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inMathBlock) {
      const m = trimmed.match(/^(`{3,}|~{3,})/);
      if (m) {
        if (!inCodeFence) {
          emit();
          inCodeFence = true;
          fenceChar = m[1][0];
          fenceLen = m[1].length;
          buf = [line];
          continue;
        }
        if (trimmed[0] === fenceChar) {
          const cr = trimmed.match(/^[`~]+/);
          if (cr && cr[0].length >= fenceLen && /^[`~]+\s*$/.test(trimmed)) {
            buf.push(line);
            inCodeFence = false;
            emit();
            continue;
          }
        }
      }
    }
    if (inCodeFence) { buf.push(line); continue; }

    if (trimmed === '$$') {
      if (!inMathBlock) { emit(); inMathBlock = true; buf = [line]; }
      else { buf.push(line); inMathBlock = false; emit(); }
      continue;
    }
    if (inMathBlock) { buf.push(line); continue; }

    if (trimmed === '') { emit(); continue; }

    buf.push(line);
  }
  emit();
  return blocks;
}
