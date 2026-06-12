import { describe, expect, it } from 'vitest';
import { extractOutlineSync } from './outlineParser';
import { indexBlocks } from './blockIndexer';
import {
  shouldUseLargeFileEngine,
  getFileOpenMode,
  DEFAULT_LARGE_FILE_SETTINGS,
  LARGE_FILE_MODE_LIMIT_BYTES,
  ONE_GIB_BYTES,
} from './largeFile';

// ── Sample MDX content used across tests ────────────────────────────

const SAMPLE_MDX = `import { Alert } from './components/Alert'
import Button from '@ui/Button'

export const metadata = {
  title: 'MDX Guide',
  version: 2,
}

# Getting Started

Welcome to the guide.

## Installation

Run the following command:

\`\`\`bash
npm install my-package
\`\`\`

<Alert type="warning">
  This is a JSX component. EXT does not execute it.
</Alert>

### Configuration

| Option   | Default | Description          |
| -------- | ------- | -------------------- |
| theme    | dark    | Color theme          |
| lang     | en      | Default language     |

export function helper() {
  return true
}

<Button variant="primary">Click me</Button>

## Final Notes

That's all for now.
`;

// ── Outline parsing ─────────────────────────────────────────────────

describe('MDX outline parsing', () => {
  it('extracts standard Markdown headings from MDX content', () => {
    const headings = extractOutlineSync(SAMPLE_MDX);
    const texts = headings.map((h) => h.text);

    expect(texts).toContain('Getting Started');
    expect(texts).toContain('Installation');
    expect(texts).toContain('Configuration');
    expect(texts).toContain('Final Notes');
  });

  it('does not produce headings from import/export/JSX lines', () => {
    const headings = extractOutlineSync(SAMPLE_MDX);
    const texts = headings.map((h) => h.text);

    // None of these MDX-specific constructs should appear as headings
    expect(texts).not.toContain("import { Alert } from './components/Alert'");
    expect(texts).not.toContain('export const metadata');
    expect(texts).not.toContain('export function helper');
    expect(texts).not.toContain('Alert');
    expect(texts).not.toContain('Button');

    // Verify we only got real headings
    for (const heading of headings) {
      expect(heading.level).toBeGreaterThanOrEqual(1);
      expect(heading.level).toBeLessThanOrEqual(6);
    }
  });

  it('returns correct heading levels', () => {
    const headings = extractOutlineSync(SAMPLE_MDX);
    const h1 = headings.find((h) => h.text === 'Getting Started');
    const h2 = headings.find((h) => h.text === 'Installation');
    const h3 = headings.find((h) => h.text === 'Configuration');

    expect(h1?.level).toBe(1);
    expect(h2?.level).toBe(2);
    expect(h3?.level).toBe(3);
  });

  it('handles MDX with only JSX and no headings', () => {
    const jsxOnly = `import { Box } from './Box'

<Box>
  <p>No headings here</p>
</Box>

export default Box
`;
    const headings = extractOutlineSync(jsxOnly);
    expect(headings).toEqual([]);
  });
});

// ── Block indexer resilience ────────────────────────────────────────

describe('MDX block indexer', () => {
  it('indexes MDX content without throwing', () => {
    expect(() => indexBlocks(SAMPLE_MDX)).not.toThrow();
  });

  it('produces blocks from MDX content', () => {
    const blocks = indexBlocks(SAMPLE_MDX);
    expect(blocks.length).toBeGreaterThan(0);

    // Every block should have a valid type
    const validTypes = ['heading', 'paragraph', 'code', 'table', 'math', 'list', 'quote', 'hr', 'other'];
    for (const block of blocks) {
      expect(validTypes).toContain(block.type);
    }
  });

  it('detects headings and code blocks inside MDX', () => {
    const blocks = indexBlocks(SAMPLE_MDX);
    const types = blocks.map((b) => b.type);

    expect(types).toContain('heading');
    expect(types).toContain('code');
    expect(types).toContain('table');
  });

  it('handles JSX-heavy content gracefully', () => {
    const jsxHeavy = `# Title

<ComponentA prop="value">
  <ComponentB>
    <ComponentC />
  </ComponentB>
</ComponentA>

<Another>
  {items.map(i => <Item key={i.id} />)}
</Another>
`;
    expect(() => indexBlocks(jsxHeavy)).not.toThrow();
    const blocks = indexBlocks(jsxHeavy);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

// ── Content preservation ────────────────────────────────────────────

describe('MDX content preservation', () => {
  it('preserves MDX content byte-for-byte through outline parsing', () => {
    // The outline parser only reads content, never modifies it.
    // This test ensures nothing in the pipeline mutates the input string.
    const original = SAMPLE_MDX;
    const copy = String(original); // independent copy

    extractOutlineSync(original);

    // Content must be identical after outline parsing
    expect(original).toBe(copy);
    expect(original.length).toBe(copy.length);
  });

  it('preserves MDX content byte-for-byte through block indexing', () => {
    const original = SAMPLE_MDX;
    const copy = String(original);

    indexBlocks(original);

    expect(original).toBe(copy);
    expect(original.length).toBe(copy.length);
  });

  it('preserves import/export/JSX lines exactly in block sources', () => {
    const blocks = indexBlocks(SAMPLE_MDX);
    const allSource = blocks.map((b) => b.source).join('\n');

    // Every MDX-specific construct must appear verbatim in the block sources
    expect(allSource).toContain("import { Alert } from './components/Alert'");
    expect(allSource).toContain("import Button from '@ui/Button'");
    expect(allSource).toContain('export const metadata');
    expect(allSource).toContain('export function helper()');
    expect(allSource).toContain('<Alert type="warning">');
    expect(allSource).toContain('<Button variant="primary">Click me</Button>');
  });

  it('does not strip, compile, or transform MDX syntax', () => {
    const mdxWithEverything = `import A from 'a'
export const x = 1

# Hello

<Component prop={value}>
  children
</Component>

export default function Page() { return <div /> }
`;
    const blocks = indexBlocks(mdxWithEverything);
    const reconstructed = blocks.map((b) => b.source).join('\n');

    // All MDX constructs must survive indexing
    expect(reconstructed).toContain("import A from 'a'");
    expect(reconstructed).toContain('export const x = 1');
    expect(reconstructed).toContain('<Component prop={value}>');
    expect(reconstructed).toContain('export default function Page()');
  });
});

// ── Large-file safeguards ───────────────────────────────────────────

describe('MDX large-file safeguards', () => {
  it('applies large-file engine to oversized MDX files', () => {
    const hugeSize = LARGE_FILE_MODE_LIMIT_BYTES + 1;
    expect(shouldUseLargeFileEngine(hugeSize, DEFAULT_LARGE_FILE_SETTINGS)).toBe(true);
  });

  it('does not apply large-file engine to small MDX files', () => {
    const smallSize = 1024; // 1 KB
    expect(shouldUseLargeFileEngine(smallSize, DEFAULT_LARGE_FILE_SETTINGS)).toBe(false);
  });

  it('always protects gigabyte-scale MDX files even with autoEnable off', () => {
    expect(shouldUseLargeFileEngine(ONE_GIB_BYTES, { autoEnable: false })).toBe(true);
  });

  it('returns correct file open mode for MDX at various sizes', () => {
    expect(getFileOpenMode(1024)).toBe('normal');
    expect(getFileOpenMode(LARGE_FILE_MODE_LIMIT_BYTES + 1)).toBe('large-file');
  });
});
