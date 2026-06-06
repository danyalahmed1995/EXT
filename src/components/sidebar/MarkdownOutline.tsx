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

export const MarkdownOutline: React.FC<MarkdownOutlineProps> = ({ content, isMarkdown }) => {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!isMarkdown || !content) {
      setHeadings([]);
      return;
    }

    const timer = setTimeout(() => {
      const lines = content.split(/\r?\n/);
      const foundHeadings: Heading[] = [];
      const headingRegex = /^(#{1,6})\s+(.+)$/;

      lines.forEach((line, index) => {
        const match = line.match(headingRegex);
        if (match) {
          foundHeadings.push({
            level: match[1].length,
            text: match[2].trim(),
            lineIndex: index,
          });
        }
      });

      setHeadings(foundHeadings);
    }, 500); // debounce outline parsing

    return () => clearTimeout(timer);
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
