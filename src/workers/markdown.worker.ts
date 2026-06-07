import markdownit from 'markdown-it';
import markdownItKatexPkg from '@vscode/markdown-it-katex';
const markdownItKatex = (markdownItKatexPkg as any).default || markdownItKatexPkg;

const md = markdownit({
  html: false,         // Disable raw HTML for security
  linkify: true,       // Auto-convert URLs to links
  typographer: true,   // Smart quotes, dashes, etc.
  breaks: true,        // Convert \n to <br>
}).use(markdownItKatex);

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
    
    // Detect excessive rendering cost or output size
    if (t1 - t0 > 50 || html.length > 20000) {
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
 *   Main → Worker:  { type: 'render-block', renderId, blockId, source }
 *   Worker → Main:  { type: 'block-result', renderId, blockId, html }
 *                    { type: 'block-error',  renderId, blockId, error }
 */
self.onmessage = (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'render-block') {
    const { renderId, blockId, source } = data;
    try {
      const html = md.render(source);
      self.postMessage({ type: 'block-result', renderId, blockId, html });
    } catch (err: any) {
      self.postMessage({ type: 'block-error', renderId, blockId, error: err.message });
    }
  }
};
