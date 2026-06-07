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

parentPort.on('message', (msg) => {
  if (msg.type === 'render-block') {
    const { renderId, blockId, source } = msg;
    try {
      const t0 = performance.now();
      const html = md.render(source);
      const elapsed = performance.now() - t0;
      parentPort.postMessage({ type: 'block-result', renderId, blockId, html, renderMs: elapsed });
    } catch (err) {
      parentPort.postMessage({ type: 'block-error', renderId, blockId, error: err.message });
    }
  }
});
