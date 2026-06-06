import React, { useMemo } from 'react';
import markdownit from 'markdown-it';
import DOMPurify from 'dompurify';
import { convertFileSrc } from '@tauri-apps/api/core';
import './MarkdownPreview.css';

// ── Markdown-it Instance ────────────────────────────

const md = markdownit({
  html: false,         // Disable raw HTML for security
  linkify: true,       // Auto-convert URLs to links
  typographer: true,   // Smart quotes, dashes, etc.
  breaks: true,        // Convert \n to <br>
});

// Enable task lists (checkbox rendering)
// Custom rule: replace [ ] and [x] in list items
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

// Custom rule: resolve local image paths
const defaultImageRender = md.renderer.rules.image || function (tokens, idx, options, _env, self) {
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const srcIndex = token.attrIndex('src');
  
  if (srcIndex >= 0 && env.absolutePath) {
    const originalSrc = token.attrs![srcIndex][1];
    
    if (!originalSrc.startsWith('http') && !originalSrc.startsWith('data:')) {
       const basePath = env.absolutePath as string;
       const isWin = basePath.includes('\\');
       const sep = isWin ? '\\' : '/';
       const dirPath = basePath.substring(0, basePath.lastIndexOf(sep));
       
       let resultPath = dirPath;
       const parts = originalSrc.split('/');
       for (const part of parts) {
         if (part === '.') continue;
         if (part === '..') {
           const lastSepIndex = resultPath.lastIndexOf(sep);
           if (lastSepIndex > 0) {
             resultPath = resultPath.substring(0, lastSepIndex);
           }
         } else if (part) {
           resultPath += sep + part;
         }
       }
       
       token.attrs![srcIndex][1] = convertFileSrc(resultPath);
    }
  }
  return defaultImageRender(tokens, idx, options, env, self);
};

// ── Types ────────────────────────────────────────────

interface MarkdownPreviewProps {
  content: string;
  absolutePath?: string;
}

// ── MarkdownPreview Component ───────────────────────

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = React.memo(({ content, absolutePath }) => {
  const renderedHtml = useMemo(() => {
    const rawHtml = md.render(content, { absolutePath });
    // [SECURITY] DOMPurify prevents XSS (Cross-Site Scripting) attacks by sanitizing the raw HTML.
    // It strips out any <script> tags, inline event handlers (onclick, onerror), and malicious URIs
    // while preserving safe styling and semantic tags required for markdown rendering.
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'del', 's',
        'a', 'img',
        'ul', 'ol', 'li',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'pre', 'code',
        'blockquote',
        'input',
        'span', 'div',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'target',
        'type', 'checked', 'disabled', 'class',
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|asset|tauri):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [content, absolutePath]);

  return (
    <div className="markdown-preview">
      <div 
        className="markdown-preview-inner"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
});
