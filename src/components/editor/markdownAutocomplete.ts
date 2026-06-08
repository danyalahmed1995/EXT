import { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { cachedViewportMetadata } from './viewportSmartEditing';

const SNIPPETS = [
  { label: '- [ ] ', type: 'text', info: 'Task list item' },
  { label: '- [x] ', type: 'text', info: 'Completed task' },
  { label: '```\n\n```', type: 'text', info: 'Code block' },
  { label: '---', type: 'text', info: 'Horizontal rule / Frontmatter' }
];

export async function markdownCompletionSource(context: CompletionContext): Promise<CompletionResult | null> {
  // Only complete if we're explicitly asking or matching a partial word
  const word = context.matchBefore(/[\w\-]+|-[ \[]*/);
  
  // If no word, don't show completions automatically unless explicitly invoked
  if (!word && !context.explicit) return null;

  const options = [...SNIPPETS];
  
  // Optional: Add local headings from our cached metadata
  if (cachedViewportMetadata && cachedViewportMetadata.headings) {
    for (const h of cachedViewportMetadata.headings) {
      options.push({
        label: `${h.text}`,
        type: 'text',
        info: `Local heading: ${h.text}`
      });
    }
  }

  if (!word) {
    return {
      from: context.pos,
      options,
      validFor: /.*/
    };
  }

  return {
    from: word.from,
    options,
    validFor: /^[\w\-]+$|^-[ \[]*$/
  };
}
