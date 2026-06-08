import React, { useEffect, useState, useRef } from 'react';
import { workerManager } from '../../workers/workerManager';
import { extractOutlineSync, type Heading } from '../../utils/outlineParser';
import './MarkdownOutline.css';

interface MarkdownOutlineProps {
  content: string;
  fileId: string;
  isMarkdown: boolean;
}

const ITEMS_PER_PAGE = 250;
const SAFE_SYNC_FALLBACK_SIZE = 500_000; // 500KB

export const MarkdownOutline: React.FC<MarkdownOutlineProps> = ({ content, fileId, isMarkdown }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [renderLimit, setRenderLimit] = useState(ITEMS_PER_PAGE);

  // Use a local session version to reject stale async results
  const sessionVersionRef = useRef(0);

  useEffect(() => {
    if (!isMarkdown || !content) {
      setHeadings([]);
      setIsScanning(false);
      return;
    }

    let isCancelled = false;
    let debounceId = 0;

    const currentVersion = ++sessionVersionRef.current;

    setIsScanning(true);
    setRenderLimit(ITEMS_PER_PAGE);

    debounceId = window.setTimeout(async () => {
      if (isCancelled) return;

      try {
        const result = await workerManager.extractOutline(fileId, currentVersion, content);
        
        // Ignore stale results
        if (isCancelled || currentVersion !== sessionVersionRef.current || fileId !== result.fileId) {
          workerManager.log(`Ignored stale outline result for v${result.version}`);
          return;
        }

        setHeadings(result.headings);
        setIsScanning(false);

      } catch (err) {
        if (isCancelled) return;
        
        workerManager.log(`Worker failed, attempting fallback`, 0);
        
        // Only fallback synchronously if the file is a safe size to avoid UI freeze
        if (content.length < SAFE_SYNC_FALLBACK_SIZE) {
          const fallbackHeadings = extractOutlineSync(content);
          if (!isCancelled && currentVersion === sessionVersionRef.current) {
            setHeadings(fallbackHeadings);
            setIsScanning(false);
          }
        } else {
          console.warn('[MarkdownOutline] File too large for synchronous fallback. Outline disabled.');
          if (!isCancelled && currentVersion === sessionVersionRef.current) {
            setHeadings([]);
            setIsScanning(false);
          }
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      if (debounceId) window.clearTimeout(debounceId);
    };
  }, [content, fileId, isMarkdown]);

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
          Outline indexing…
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
