export interface Heading {
  level: number;
  text: string;
  lineIndex: number;
}

/**
 * Extracts Markdown headings synchronously from the given content.
 * Parses line by line, detecting #, ##, ###, etc.
 * Supports a timeout or yield mechanism if executed on main thread.
 * 
 * @param content The full markdown content.
 * @param maxExecutionMs Optional max time to spend before yielding. If 0 or omitted, parses everything synchronously.
 * @param onProgress Callback fired with newly found headings if executing in chunks (useful for UI).
 * @returns Array of Headings.
 */
export function extractOutlineSync(content: string): Heading[] {
  const headings: Heading[] = [];
  let position = 0;
  let lineIndex = 0;

  while (position < content.length) {
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
            headings.push({
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

  return headings;
}
