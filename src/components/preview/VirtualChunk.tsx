import React, { useEffect, useRef, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { convertFileSrc } from '@tauri-apps/api/core';

interface VirtualChunkProps {
  html: string;
  absolutePath?: string;
}

const processLocalImages = (html: string, basePath?: string): string => {
  if (!basePath) return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');

  images.forEach((img) => {
    const originalSrc = img.getAttribute('src');
    if (originalSrc && !originalSrc.startsWith('http') && !originalSrc.startsWith('data:')) {
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

      img.setAttribute('src', convertFileSrc(resultPath));
    }
  });

  return doc.body.innerHTML;
};

export const VirtualChunk: React.FC<VirtualChunkProps> = React.memo(({ html, absolutePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [cachedHeight, setCachedHeight] = useState<number | undefined>(undefined);

  // Defer DOMPurify strictly to when the component is visible to prevent main thread blocking
  const safeHtml = useMemo(() => {
    if (!isVisible) return ''; // Skip heavy parsing if off-screen
    
    const withImages = processLocalImages(html, absolutePath);
    return DOMPurify.sanitize(withImages, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'strong', 'em', 'del', 's', 'a', 'img',
        'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'pre', 'code', 'blockquote', 'input', 'span', 'div',
        'math', 'annotation', 'semantics', 'mrow', 'mi', 'mn', 'mo', 'ms', 'mspace', 'mtext', 'menclose', 'merror', 'mpadded', 'mphantom', 'mroot', 'msqrt', 'msub', 'msup', 'msubsup', 'mmultiscripts', 'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'target',
        'type', 'checked', 'disabled', 'class', 'style', 'aria-hidden',
        'mathvariant', 'encoding', 'display', 'xmlns',
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|asset|tauri):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [html, absolutePath, isVisible]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        setIsVisible(true);
      } else {
        // Cache height before unmounting contents to preserve scrollbar position
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.height > 0) {
             setCachedHeight(rect.height);
          }
        }
        setIsVisible(false);
      }
    }, { 
      // Unmount aggressively when it leaves a generous viewport margin
      rootMargin: '1000px' 
    });

    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ minHeight: isVisible ? undefined : cachedHeight }}
      className="virtual-chunk"
    >
      {isVisible ? <div dangerouslySetInnerHTML={{ __html: safeHtml }} /> : null}
    </div>
  );
});
