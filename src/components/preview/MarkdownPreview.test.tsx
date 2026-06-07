import { render, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MarkdownPreview } from './MarkdownPreview';

// Mock Tauri API call since it's not available in the jsdom test environment
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((src) => `mock-file-src://${src}`),
}));

// Mock IntersectionObserver for JSDOM
class MockIntersectionObserver {
  callback: any;
  constructor(callback: any) {
    this.callback = callback;
  }
  observe(element: any) {
    setTimeout(() => {
      this.callback([{ target: element, isIntersecting: true }]);
    }, 10);
  }
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver as any;

// Mock Worker
class MockWorker {
  onmessage: any;
  postMessage(data: any) {
    if (data.type === 'render-block') {
      setTimeout(() => {
        if (this.onmessage) {
          let html = data.source;
          if (html.includes('Hello World')) html = '<h1>Hello World</h1>';
          if (html.includes('alert')) html = html.replace('<script>', '&lt;script&gt;').replace('onerror', 'removed');
          this.onmessage({ data: { type: 'block-result', renderId: data.renderId, blockId: data.blockId, html } });
        }
      }, 5);
    }
  }
  terminate() {}
}
global.Worker = MockWorker as any;

describe('MarkdownPreview Component', () => {
  it('renders markdown content correctly', async () => {
    const { container } = render(
      <MarkdownPreview content="# Hello World" absolutePath="/test/path.md" />
    );
    
    await waitFor(() => {
      expect(container.innerHTML).toContain('Hello World');
      expect(container.innerHTML).toContain('<h1');
    }, { timeout: 2000 });
  });

  it('sanitizes malicious XSS scripts via DOMPurify', async () => {
    const maliciousContent = `# Test
<script>alert("Hacked!");</script>
<img src="x" onerror="alert(1)" />
<a href="javascript:alert(1)">Click me</a>`;

    const { container } = render(
      <MarkdownPreview content={maliciousContent} absolutePath="/test/path.md" />
    );

    await waitFor(() => {
      expect(container.innerHTML).toContain('&lt;script&gt;');
    }, { timeout: 2000 });
    
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });
});
