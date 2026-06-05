import React, { useMemo } from 'react';
import markdownit from 'markdown-it';
import DOMPurify from 'dompurify';
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

// ── Types ────────────────────────────────────────────

interface MarkdownPreviewProps {
  content: string;
}

// ── MarkdownPreview Component ───────────────────────

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const renderedHtml = useMemo(() => {
    const rawHtml = md.render(content);
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
    });
  }, [content]);

  return (
    <div
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
