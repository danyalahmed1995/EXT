import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import markdownit from 'markdown-it';
import markdownItKatexPkg from '@vscode/markdown-it-katex';
import { MarkdownPreview } from './MarkdownPreview';

const markdownItKatex = (markdownItKatexPkg as any).default || markdownItKatexPkg;
const md = markdownit({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
}).use(markdownItKatex);

// Mock Tauri API call since it's not available in the jsdom test environment
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((src) => `asset://localhost/${src.replace(/^\/+/, '')}`),
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
            const html = md.render(data.source);
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
      expect(container.querySelector('a')).toBeTruthy();
    }, { timeout: 2000 });
    
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('onerror')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBeNull();
    expect(container.innerHTML).not.toContain('alert("Hacked!")');
  });

  it('renders safe README-style centered HTML images', async () => {
    const readmeHtml = `<p align="center">
  <img src="./src-tauri/icons/icon.png" alt="EXT" width="96" height="96" />
</p>`;

    const { container } = render(
      <MarkdownPreview content={readmeHtml} absolutePath="/repo/README.md" />
    );

    await waitFor(() => {
      expect(container.querySelector('p[align="center"] img[alt="EXT"]')).toBeTruthy();
    }, { timeout: 2000 });

    const img = container.querySelector('img');
    expect(container.innerHTML).not.toContain('&lt;p');
    expect(container.innerHTML).not.toContain('&lt;img');
    expect(img?.getAttribute('src')).toBe('asset://localhost/repo/src-tauri/icons/icon.png');
    expect(img?.getAttribute('width')).toBe('96');
    expect(img?.getAttribute('height')).toBe('96');
  });

  it('renders README badge links and images while sanitizing unsafe link URLs', async () => {
    const badgeHtml = `<p align="center">
  <a href="https://example.com/project"><img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build" /></a>
  <a href="javascript:alert('xss')"><img src="https://img.shields.io/badge/bad-link-red" alt="Bad" /></a>
</p>`;

    const { container } = render(
      <MarkdownPreview content={badgeHtml} absolutePath="/repo/README.md" />
    );

    await waitFor(() => {
      expect(container.querySelectorAll('a img')).toHaveLength(2);
    }, { timeout: 2000 });

    const links = container.querySelectorAll('a');
    expect(links[0].getAttribute('href')).toBe('https://example.com/project');
    expect(links[1].getAttribute('href')).toBeNull();
    expect(container.querySelector('img[alt="Build"]')?.getAttribute('src')).toBe('https://img.shields.io/badge/build-passing-brightgreen');
  });

  it('preserves local markdown image resolution', async () => {
    const { container } = render(
      <MarkdownPreview content="![Demo](./public/demo-example/demo_part1.gif)" absolutePath="/repo/README.md" />
    );

    await waitFor(() => {
      expect(container.querySelector('img[alt="Demo"]')).toBeTruthy();
    }, { timeout: 2000 });

    expect(container.querySelector('img')?.getAttribute('src')).toBe('asset://localhost/repo/public/demo-example/demo_part1.gif');
  });

  it('renders inline LaTeX through KaTeX', async () => {
    const { container } = render(
      <MarkdownPreview content="Euler: $e^{i\\pi}+1=0$" absolutePath="/repo/math.md" />
    );

    await waitFor(() => {
      expect(container.querySelector('.katex')).toBeTruthy();
    }, { timeout: 2000 });
  });
});
