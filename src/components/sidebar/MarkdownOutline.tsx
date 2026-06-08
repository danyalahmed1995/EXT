import React, { useEffect, useState } from 'react';
import './MarkdownOutline.css';

interface Heading {
  level: number;
  text: string;
  lineIndex: number;
}

interface MarkdownOutlineProps {
  content: string;
  isMarkdown: boolean;
}

const MAX_OUTLINE_ITEMS = 250;

export const MarkdownOutline: React.FC<MarkdownOutlineProps> = ({ content, isMarkdown }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!isMarkdown || !content) {
      setHeadings([]);
      return;
    }

    let cancelled = false;
    let idleId = 0;
    let debounceId = 0;

    const schedule = (callback: IdleRequestCallback) => {
      if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, { timeout: 750 });
      }
      return globalThis.setTimeout(() => {
        callback({ didTimeout: true, timeRemaining: () => 4 } as IdleDeadline);
      }, 16);
    };

    const cancelScheduled = () => {
      if (idleId) {
        if ('cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleId);
        } else {
          globalThis.clearTimeout(idleId);
        }
      }
      if (debounceId) window.clearTimeout(debounceId);
    };

    debounceId = window.setTimeout(() => {
      let position = 0;
      let lineIndex = 0;
      let atLineStart = true;
      const foundHeadings: Heading[] = [];
      let totalHeadings = 0;
      let maxChunkMs = 0;
      const startedAt = performance.now();

      const processChunk: IdleRequestCallback = (_deadline) => {
        const chunkStart = performance.now();

        while (position < content.length && performance.now() - chunkStart < 4) {
          if (atLineStart && content.charCodeAt(position) === 35) {
            let cursor = position;
            while (cursor < content.length && cursor - position < 6 && content.charCodeAt(cursor) === 35) {
              cursor++;
            }
            const level = cursor - position;
            const nextChar = content.charCodeAt(cursor);
            if (level >= 1 && level <= 6 && (nextChar === 32 || nextChar === 9)) {
              const maxTitleEnd = Math.min(content.length, cursor + 512);
              const nextBreak = content.indexOf('\n', cursor + 1);
              const rawTitleEnd = nextBreak === -1 ? maxTitleEnd : Math.min(nextBreak, maxTitleEnd);
              const titleEnd = rawTitleEnd > cursor && content.charCodeAt(rawTitleEnd - 1) === 13 ? rawTitleEnd - 1 : rawTitleEnd;
              const text = content.slice(cursor + 1, titleEnd).trim();
              if (text) {
                totalHeadings++;
                if (foundHeadings.length < MAX_OUTLINE_ITEMS) {
                  foundHeadings.push({
                    level,
                    text,
                    lineIndex,
                  });
                }
              }
            }
          }

          atLineStart = false;
          if (content.charCodeAt(position) === 10) {
            lineIndex++;
            atLineStart = true;
          }
          position++;
        }

        maxChunkMs = Math.max(maxChunkMs, performance.now() - chunkStart);
        if (cancelled) return;

        if (position >= content.length) {
          const totalMs = performance.now() - startedAt;
          if (totalMs > 16 || maxChunkMs > 8) {
            console.log(
              `[NavigationPerf] outline generation: total=${totalMs.toFixed(1)}ms maxChunk=${maxChunkMs.toFixed(1)}ms (${lineIndex} lines, ${totalHeadings} headings, rendered=${foundHeadings.length})`,
            );
          }
          setHeadings(foundHeadings);
        } else {
          idleId = schedule(processChunk);
        }
      };

      idleId = schedule(processChunk);
    }, 300);

    return () => {
      cancelled = true;
      cancelScheduled();
    };
  }, [content, isMarkdown]);

  if (!isMarkdown || headings.length === 0) {
    return null;
  }

  const handleHeadingClick = (lineIndex: number) => {
    const event = new CustomEvent('editor-scroll-to-line', {
      detail: { lineIndex }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="markdown-outline">
      {headings.map((h, i) => (
        <div
          key={`${h.lineIndex}-${i}`}
          className={`markdown-outline-item level-${h.level}`}
          style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
          onClick={() => handleHeadingClick(h.lineIndex)}
          title={h.text}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
};
