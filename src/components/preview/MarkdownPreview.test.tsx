import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';

// Mock Tauri API call since it's not available in the jsdom test environment
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((src) => `mock-file-src://${src}`),
}));

describe('MarkdownPreview Component', () => {
  it('renders markdown content correctly', () => {
    const { container } = render(
      <MarkdownPreview content="# Hello World" absolutePath="/test/path.md" />
    );
    expect(container.innerHTML).toContain('Hello World');
    expect(container.innerHTML).toContain('<h1');
  });

  it('sanitizes malicious XSS scripts via DOMPurify', () => {
    const maliciousContent = `# Test
<script>alert("Hacked!");</script>
<img src="x" onerror="alert(1)" />
<a href="javascript:alert(1)">Click me</a>`;

    const { container } = render(
      <MarkdownPreview content={maliciousContent} absolutePath="/test/path.md" />
    );

    // Since markdown-it has `html: false`, raw HTML is encoded to safe text entities.
    // Quotes are converted to typographic smart quotes.
    expect(container.innerHTML).toContain('&lt;script&gt;');
    expect(container.innerHTML).toContain('onerror');
    
    // The content is rendered safely as text rather than executable DOM nodes
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });
});
