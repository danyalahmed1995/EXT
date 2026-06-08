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

const ITEMS_PER_PAGE = 250;
const MAX_CHUNK_MS = 8;

export const MarkdownOutline: React.FC<MarkdownOutlineProps> = ({ content, isMarkdown }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [renderLimit, setRenderLimit] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    if (!isMarkdown || !content) {
      setHeadings([]);
      setIsScanning(false);
      return;
    }

    let cancelled = false;
    let idleId = 0;
    let debounceId = 0;

    const cancelScheduled = () => {
      if (idleId) globalThis.clearTimeout(idleId);
      if (debounceId) window.clearTimeout(debounceId);
    };

    setIsScanning(true);
    setHeadings([]);
    setRenderLimit(ITEMS_PER_PAGE);

    debounceId = window.setTimeout(() => {
      let position = 0;
      let lineIndex = 0;
      let allHeadings: Heading[] = [];

      const processChunk = () => {
        const chunkStart = performance.now();
        let newlyFound: Heading[] = [];

        while (performance.now() - chunkStart < MAX_CHUNK_MS) {
          if (position >= content.length) {
            if (newlyFound.length > 0) {
              allHeadings = allHeadings.concat(newlyFound);
              setHeadings([...allHeadings]);
            }
            if (!cancelled) {
              setIsScanning(false);
            }
            return;
          }

          const nextNewline = content.indexOf('\n', position);
          const endOfLine = nextNewline === -1 ? content.length : nextNewline;
          
          let cursor = position;
          if (position === 0 && content.charCodeAt(0) === 0xFEFF) cursor++;
          
          while (cursor < endOfLine && (content.charCodeAt(cursor) === 32 || content.charCodeAt(cursor) === 9)) {
            cursor++;
          }
          
          const hashStart = cursor;
          if (content.charCodeAt(cursor) === 35) {
            while(cursor < endOfLine && content.charCodeAt(cursor) === 35) cursor++;
            const level = cursor - hashStart;
            
            if (level >= 1 && level <= 6 && cursor < endOfLine) {
              const nextChar = content.charCodeAt(cursor);
              if (nextChar === 32 || nextChar === 9) {
                let titleEnd = endOfLine;
                if (titleEnd > cursor && content.charCodeAt(titleEnd - 1) === 13) titleEnd--;
                const text = content.slice(cursor + 1, titleEnd).trim();
                
                if (text) {
                  newlyFound.push({
                    level,
                    text,
                    lineIndex
                  });
                }
              }
            }
          }
          
          position = endOfLine + 1;
          lineIndex++;
        }

        if (cancelled) return;

        if (newlyFound.length > 0) {
          allHeadings = allHeadings.concat(newlyFound);
          setHeadings([...allHeadings]);
        }

        idleId = globalThis.setTimeout(processChunk, 10);
      };

      idleId = globalThis.setTimeout(processChunk, 0);
    }, 150);

    return () => {
      cancelled = true;
      cancelScheduled();
    };
  }, [content, isMarkdown]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      if (renderLimit < headings.length) {
        setRenderLimit(prev => Math.min(prev + ITEMS_PER_PAGE, headings.length));
      }
    }
  };

  if (!isMarkdown) return null;

  const handleHeadingClick = (lineIndex: number) => {
    const event = new CustomEvent('editor-scroll-to-line', {
      detail: { lineIndex }
    });
    window.dispatchEvent(event);
  };

  const visibleHeadings = headings.slice(0, renderLimit);

  return (
    <div className="markdown-outline" onScroll={handleScroll}>
      {visibleHeadings.map((h, i) => (
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
      
      {isScanning && (
        <div className="markdown-outline-status">
          <span className="scanning-dot" />
          Outline indexing… {headings.length} loaded
        </div>
      )}
      {!isScanning && headings.length === 0 && (
        <div className="markdown-outline-status empty">
          No headings found
        </div>
      )}
      {!isScanning && headings.length > ITEMS_PER_PAGE && renderLimit < headings.length && (
        <div className="markdown-outline-status">
          Scroll to load more...
        </div>
      )}
      {!isScanning && headings.length > 0 && renderLimit >= headings.length && (
        <div className="markdown-outline-status complete">
          Outline ready • {headings.length} headings
        </div>
      )}
    </div>
  );
};
