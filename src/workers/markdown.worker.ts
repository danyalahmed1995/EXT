import markdownit from 'markdown-it';
import markdownItKatexPkg from '@vscode/markdown-it-katex';
import { indexBlocks } from '../utils/blockIndexer';
const markdownItKatex = (markdownItKatexPkg as any).default || markdownItKatexPkg;

const md = markdownit({
  html: false,         // Disable raw HTML for security
  linkify: true,       // Auto-convert URLs to links
  typographer: true,   // Smart quotes, dashes, etc.
  breaks: true,        // Convert \n to <br>
}).use(markdownItKatex);

const MAX_RENDERED_BLOCK_HTML = 100_000;
const MAX_RENDERED_BLOCK_NODES = 2_500;
const MAX_BLOCK_RENDER_MS = 75;

// Enable task lists (checkbox rendering)
const defaultRender = md.renderer.rules.list_item_open || function (tokens, idx, options, _env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.list_item_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx + 2]; // inline content token
  if (token && token.content) {
    if (token.content.startsWith('[ ] ')) {
      token.content = token.content.slice(4);
      token.children?.[0] && (token.children[0].content = token.children[0].content.slice(4));
      return '<li class="task-list-item"><input type="checkbox" disabled> ';
    }
    if (token.content.startsWith('[x] ') || token.content.startsWith('[X] ')) {
      token.content = token.content.slice(4);
      token.children?.[0] && (token.children[0].content = token.children[0].content.slice(4));
      return '<li class="task-list-item"><input type="checkbox" checked disabled> ';
    }
  }
  return defaultRender(tokens, idx, options, env, self);
};

/**
 * Escape HTML to prevent XSS in fallback blocks
 */
function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fallbackBlock(source: string, reason: string) {
  return `<div class="math-fallback-block"><div class="math-fallback-title">Preview block simplified: ${escapeHtml(reason)}</div><pre class="math-fallback-source"><code>${escapeHtml(source.substring(0, 500))}${source.length > 500 ? '...' : ''}</code></pre></div>`;
}

function renderedNodeCount(html: string) {
  const matches = html.match(/<[^>]+>/g);
  return matches ? matches.length : 0;
}

// Add Pathological Math Protection Interceptors
const defaultMathBlock = md.renderer.rules.math_block;
if (defaultMathBlock) {
  md.renderer.rules.math_block = function (tokens: any, idx: number, options: any, env: any, self: any) {
    const content = tokens[idx].content;
    
    // Fast fail for absurdly large source strings without even rendering
    if (content.length > 10000) {
      return `<div class="math-fallback-block"><div class="math-fallback-title">⚠️ Math expression too large to preview</div><pre class="math-fallback-source"><code>${escapeHtml(content.substring(0, 200))}...</code></pre></div>`;
    }
    
    const t0 = performance.now();
    let html = "";
    try {
      html = defaultMathBlock(tokens, idx, options, env, self);
    } catch (err: any) {
      return `<div class="math-fallback-block"><div class="math-fallback-title">⚠️ Math render error</div><pre class="math-fallback-source"><code>${escapeHtml(err.message)}</code></pre></div>`;
    }
    const t1 = performance.now();
    
    // Detect excessive rendering cost, output size, or DOM complexity
    const nodeCount = (html.match(/<[^>]+>/g) || []).length;
    if (t1 - t0 > 50 || html.length > 20000 || nodeCount > 500) {
      return `<div class="math-fallback-block"><div class="math-fallback-title">⚠️ Math expression too complex to preview safely</div><pre class="math-fallback-source"><code>${escapeHtml(content.substring(0, 200))}...</code></pre></div>`;
    }
    
    // Wrap safe output in a bounded container
    return `<div class="safe-math-container">${html}</div>`;
  };
}

const defaultMathInline = md.renderer.rules.math_inline;
if (defaultMathInline) {
  md.renderer.rules.math_inline = function (tokens: any, idx: number, options: any, env: any, self: any) {
    const content = tokens[idx].content;
    if (content.length > 5000) {
      return `<span class="math-fallback-inline" title="Math too long">⚠️ [Complex Math]</span>`;
    }
    
    const t0 = performance.now();
    let html = "";
    try {
      html = defaultMathInline(tokens, idx, options, env, self);
    } catch (err) {
      return `<span class="math-fallback-inline" title="Error rendering math">⚠️ [Math Error]</span>`;
    }
    const t1 = performance.now();
    
    if (t1 - t0 > 25 || html.length > 5000) {
      return `<span class="math-fallback-inline" title="Math expression too complex">⚠️ [Complex Math]</span>`;
    }
    
    return `<span class="safe-math-inline-container">${html}</span>`;
  };
}

/**
 * Demand-driven worker: renders individual source blocks on request.
 * Protocol:
 *   Main → Worker:  { type: 'index-blocks', indexId, content }
 *   Worker → Main:  { type: 'index-result', indexId, blocks, indexMs }
 *                    { type: 'index-error',  indexId, error }
 *   Main → Worker:  { type: 'render-block', renderId, blockId, source }
 *   Worker → Main:  { type: 'block-result', renderId, blockId, html }
 *                    { type: 'block-error',  renderId, blockId, error }
 */
self.onmessage = (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'index-blocks') {
    const { indexId, content } = data;
    const t0 = performance.now();
    try {
      const blocks = indexBlocks(content);
      self.postMessage({
        type: 'index-result',
        indexId,
        blocks,
        indexMs: performance.now() - t0,
      });
    } catch (err: any) {
      self.postMessage({ type: 'index-error', indexId, error: err.message });
    }
    return;
  }

  if (data.type === 'render-block') {
    const { renderId, blockId, source } = data;
    try {
      const t0 = performance.now();
      const html = md.render(source);
      const renderMs = performance.now() - t0;
      if (
        renderMs > MAX_BLOCK_RENDER_MS ||
        html.length > MAX_RENDERED_BLOCK_HTML ||
        renderedNodeCount(html) > MAX_RENDERED_BLOCK_NODES
      ) {
        self.postMessage({
          type: 'block-result',
          renderId,
          blockId,
          html: fallbackBlock(source, 'block too complex to preview safely'),
        });
        return;
      }
      self.postMessage({ type: 'block-result', renderId, blockId, html });
    } catch (err: any) {
      self.postMessage({ type: 'block-error', renderId, blockId, error: err.message });
    }
  }
};
