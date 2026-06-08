/**
 * Benchmark worker – renders individual markdown blocks on demand.
 * Protocol mirrors markdown.worker.ts.
 */
import { parentPort } from 'worker_threads';
import markdownit from 'markdown-it';
import markdownItKatexPkg from '@vscode/markdown-it-katex';
const markdownItKatex = markdownItKatexPkg.default || markdownItKatexPkg;

const md = markdownit({ html: false, linkify: true, typographer: true, breaks: true })
  .use(markdownItKatex);

const MAX_RENDERED_BLOCK_HTML = 100_000;
const MAX_RENDERED_BLOCK_NODES = 2_500;
const MAX_BLOCK_RENDER_MS = 75;

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fallbackBlock(source, reason) {
  return `<div class="math-fallback-block"><div class="math-fallback-title">Preview block simplified: ${escapeHtml(reason)}</div><pre class="math-fallback-source"><code>${escapeHtml(source.substring(0, 500))}${source.length > 500 ? '...' : ''}</code></pre></div>`;
}

function renderedNodeCount(html) {
  const matches = html.match(/<[^>]+>/g);
  return matches ? matches.length : 0;
}

parentPort.on('message', (msg) => {
  if (msg.type === 'render-block') {
    const { renderId, blockId, source } = msg;
    try {
      const t0 = performance.now();
      let html = md.render(source);
      const elapsed = performance.now() - t0;
      if (
        elapsed > MAX_BLOCK_RENDER_MS ||
        html.length > MAX_RENDERED_BLOCK_HTML ||
        renderedNodeCount(html) > MAX_RENDERED_BLOCK_NODES
      ) {
        html = fallbackBlock(source, 'block too complex to preview safely');
      }
      parentPort.postMessage({ type: 'block-result', renderId, blockId, html, renderMs: elapsed });
    } catch (err) {
      parentPort.postMessage({ type: 'block-error', renderId, blockId, error: err.message });
    }
  }
});
