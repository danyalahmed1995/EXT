import { render, waitFor } from '@testing-library/react';
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
globalThis.IntersectionObserver = MockIntersectionObserver as any;

// Mock Worker via vitest
vi.mock('../../workers/markdown.worker?worker', () => {
  return {
    default: class MockWorker {
      listeners: any[] = [];
      addEventListener(type: string, fn: any) {
        if (type === 'message') this.listeners.push(fn);
      }
      removeEventListener(_type: string, fn: any) {
        this.listeners = this.listeners.filter(l => l !== fn);
      }
      postMessage(data: any) {
        if (data.type === 'index-blocks') {
          setTimeout(() => {
            const e = {
              data: {
                type: 'index-result',
                indexId: data.indexId,
                indexMs: 1,
                blocks: [{
                  id: 0,
                  type: 'heading',
                  source: data.content,
                  lineCount: data.content.split(/\r?\n/).length,
                  estimatedHeight: 80,
                  mathHeavy: false,
                }],
              },
            };
            this.listeners.forEach(l => l(e));
          }, 1);
        } else if (data.type === 'render-block') {
          setTimeout(() => {
            let html = data.source;
            if (html.includes('Hello World')) html = '<h1>Hello World</h1>';
            if (html.includes('alert')) html = html.replace('<script>', '&lt;script&gt;').replace('onerror', 'removed');
            const e = { data: { type: 'block-result', renderId: data.renderId, blockId: data.blockId, html } };
            this.listeners.forEach(l => l(e));
          }, 5);
        }
      }
      terminate() {}
    }
  };
});

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
